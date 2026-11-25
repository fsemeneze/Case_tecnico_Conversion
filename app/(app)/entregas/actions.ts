"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { schemaEntrega, primeiroErro } from "@/lib/validacao";
import { enviarEmail, emailLinkAprovacao, emailDecisaoCliente } from "@/lib/email";

const TIPOS = ["Relatório", "Análise", "Conteúdo"] as const;

// ---------------------------------------------------------------------------
// Cadastro de entrega (time, com sessão — RLS por papel aplica)
// ---------------------------------------------------------------------------

export type ResultadoCadastro =
  | { ok: false; erro: string; campos?: Record<string, string> }
  | { ok: true; id: number };

export async function cadastrarEntrega(
  entrada: Record<string, unknown>,
): Promise<ResultadoCadastro> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou. Entre novamente." };

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !["admin", "gestor", "operador"].includes(perfil.papel)) {
    return { ok: false, erro: "Seu perfil só pode consultar. Peça acesso ao administrador." };
  }

  const dados = schemaEntrega.safeParse(entrada);
  if (!dados.success) {
    return { ok: false, erro: primeiroErro(dados) ?? "Dados inválidos." };
  }
  if (!TIPOS.includes(dados.data.tipo as (typeof TIPOS)[number])) {
    return { ok: false, erro: "Tipo inválido." };
  }
  const v = dados.data;

  // Cliente: existente ou novo.
  let clienteId: number;
  if (v.novo_cliente) {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({ nome: v.novo_cliente })
      .select("id")
      .single();
    if (error || !cliente) {
      return { ok: false, erro: `Não foi possível criar o cliente: ${error?.message ?? "erro"}` };
    }
    clienteId = cliente.id;
  } else {
    const id = Number(v.cliente_id);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, erro: "Selecione um cliente ou informe o nome de um novo." };
    }
    clienteId = id;
  }

  // Dimensões derivadas do formulário.
  const [tipo, fase, decisao, origem] = await Promise.all([
    supabase
      .from("tipos_entrega")
      .select("id")
      .eq("tipo", v.tipo)
      .is("subtipo", v.subtipo || null)
      .maybeSingle(),
    supabase.from("fases").select("id").eq("codigo", "solicitada").single(),
    supabase.from("decisoes_aprovacao").select("id").eq("codigo", "pendente").single(),
    supabase.from("origens").select("id").eq("codigo", "app").single(),
  ]);

  if (!tipo.data || !fase.data || !decisao.data || !origem.data) {
    return { ok: false, erro: "Não foi possível resolver as dimensões da entrega." };
  }

  const { data, error } = await supabase
    .from("entregas")
    .insert({
      cliente_id: clienteId,
      tipo_entrega_id: tipo.data.id,
      fase_id: fase.data.id,
      origem_id: origem.data.id,
      aprovacao_planejamento_id: decisao.data.id,
      aprovacao_entrega_id: decisao.data.id,
      titulo: v.titulo,
      squad_id: null,
      pessoa_id: null,
      data_solicitacao_id: v.data_solicitacao || null,
      data_prevista_id: v.data_prevista || null,
      link: v.link || null,
      observacoes: v.observacoes || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: `Não foi possível salvar: ${error?.message ?? "erro"}` };
  }

  // Squad e responsável são dimensões: resolve ou cria.
  const squadId = v.squad
    ? (await supabase.from("squads").select("id").eq("nome", v.squad).maybeSingle()).data?.id ?? null
    : null;
  const pessoaId = v.responsavel
    ? (await supabase.from("pessoas").select("id").eq("nome", v.responsavel).maybeSingle()).data?.id ?? null
    : null;

  if (squadId || pessoaId) {
    await supabase
      .from("entregas")
      .update({ squad_id: squadId, pessoa_id: pessoaId })
      .eq("id", data.id);
  }

  revalidatePath("/inicio");
  revalidatePath("/entregas");
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Link de aprovação (time → cliente)
// ---------------------------------------------------------------------------

function urlBase() {
  return (async () => {
    const cabecalhos = await headers();
    const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
    const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
    return `${protocolo}://${host}`;
  })();
}

export async function gerarLinkAprovacao(formulario: FormData) {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || !["admin", "gestor"].includes(perfil.papel)) {
    redirect("/entregas?erro=Seu+perfil+não+pode+gerar+links+de+aprovação");
  }

  const entregaId = Number(formulario.get("entrega_id"));
  const etapa = String(formulario.get("etapa") ?? "");
  if (!entregaId || !["planejamento", "entrega"].includes(etapa)) {
    redirect("/entregas");
  }

  const admin = criarClienteSupabaseAdmin();
  const { data, error } = await admin.rpc("criar_token_aprovacao", {
    p_entrega_id: entregaId,
    p_etapa: etapa,
    p_validade_horas: 168,
  });

  if (error || !data) {
    redirect(
      `/entregas/${entregaId}?erro=${encodeURIComponent(
        error?.message ?? "Não foi possível gerar o token.",
      )}`,
    );
  }

  revalidatePath(`/entregas/${entregaId}`);

  // E-mail automático ao cliente com o link (D). Se não houver e-mail cadastrado
  // ou a chave do provedor, apenas registra no log — o link continua sendo gerado.
  const { data: ent } = await admin
    .from("entregas_detalhadas")
    .select("titulo, cliente, data_prevista")
    .eq("id", entregaId)
    .maybeSingle();
  if (ent) {
    const { data: cli } = await admin
      .from("clientes")
      .select("email")
      .eq("nome", ent.cliente)
      .maybeSingle();
    if (cli?.email) {
      const tpl = emailLinkAprovacao({
        cliente: ent.cliente,
        titulo: ent.titulo,
        etapa,
        prazo: ent.data_prevista,
        url: `${await urlBase()}/aprovacao/${data}`,
        validadeDias: 7,
      });
      await enviarEmail({ para: cli.email, ...tpl, tipo: "link_aprovacao", entidadeId: entregaId });
    }
  }

  redirect(`/entregas/${entregaId}?token_criado=${data}`);
}

// ---------------------------------------------------------------------------
// Aprovação via link (página pública, sem login)
// ---------------------------------------------------------------------------

export type ResultadoAprovacao = { ok: boolean; mensagem: string; fase?: string };

export async function aprovarViaToken(
  token: string,
  decisao: string,
  autorNome: string,
  autorEmail: string | null,
  observacao: string | null,
): Promise<ResultadoAprovacao> {
  if (!["aprovada", "aprovada_com_ressalvas", "recusada"].includes(decisao)) {
    return { ok: false, mensagem: "Decisão inválida." };
  }
  if (!autorNome.trim()) {
    return { ok: false, mensagem: "Informe o seu nome." };
  }
  if (!autorEmail?.trim() || !autorEmail.includes("@")) {
    return { ok: false, mensagem: "Informe o seu e-mail." };
  }

  // Origem da aprovação: registrada junto da decisão para rastreabilidade.
  const cabecalhos = await headers();
  const ip =
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabecalhos.get("x-real-ip") ||
    null;
  const userAgent = cabecalhos.get("user-agent")?.slice(0, 500) ?? null;

  const admin = criarClienteSupabaseAdmin();
  const { data, error } = await admin.rpc("registrar_aprovacao", {
    p_token: token,
    p_decisao: decisao,
    p_autor_nome: autorNome.trim(),
    p_autor_email: autorEmail.trim(),
    p_observacao: observacao?.trim() || null,
    p_autor_ip: ip,
    p_autor_user_agent: userAgent,
  });

  if (error) {
    return { ok: false, mensagem: error.message };
  }

  revalidatePath("/inicio");
  revalidatePath("/entregas");
  revalidatePath(`/entregas/${data.entrega_id}`);

  // Avisa o time por e-mail sobre a decisão do cliente (D).
  const equipe = process.env.EMAIL_EQUIPE;
  if (equipe) {
    const { data: ent } = await admin
      .from("entregas_detalhadas")
      .select("cliente")
      .eq("id", data.entrega_id)
      .maybeSingle();
    const tpl = emailDecisaoCliente({
      titulo: data.titulo,
      cliente: ent?.cliente ?? "Cliente",
      etapa: data.etapa,
      decisao,
      autor: autorNome,
      observacao: observacao ?? null,
    });
    await enviarEmail({ para: equipe, ...tpl, tipo: "decisao_cliente", entidadeId: data.entrega_id });
  }

  return {
    ok: true,
    mensagem:
      decisao === "recusada"
        ? "Ajuste solicitado. O time da Conversion vai reavaliar e devolver o prazo."
        : "Obrigado! A aprovação foi registrada e o time recebeu a atualização.",
    fase: data.fase,
  };
}