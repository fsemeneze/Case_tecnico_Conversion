"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { schemaEntrega, schemaEdicaoEntrega, primeiroErro } from "@/lib/validacao";
import { enviarEmail, emailLinkAprovacao, emailDecisaoCliente, emailComprovante } from "@/lib/email";
import { verificarLimite, chaveDeIp } from "@/lib/rate-limit";

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
  // Subtipo vazio tem fallback (D9): Análise → "Análise não especificada",
  // Conteúdo → "Artigo", Relatório → sem subtipo. Sem isso, o cadastro de
  // Análise/Conteúdo falharia ao deixar o subtipo em branco.
  const subtipoBase =
    v.subtipo ||
    (v.tipo === "Análise"
      ? "Análise não especificada"
      : v.tipo === "Conteúdo"
        ? "Artigo"
        : null);

  const [tipo, fase, decisao, origem] = await Promise.all([
    supabase
      .from("tipos_entrega")
      .select("id")
      .eq("tipo", v.tipo)
      .is("subtipo", subtipoBase)
      .maybeSingle(),
    supabase.from("fases").select("id").eq("codigo", "solicitada").single(),
    supabase.from("decisoes_aprovacao").select("id").eq("codigo", "pendente").single(),
    supabase.from("origens").select("id").eq("codigo", "app").single(),
  ]);

  // Subtipo inexistente na dimensão (ex.: digitado à mão) cai no genérico —
  // a entrega é cadastrada, não bloqueada (D9).
  let tipoId = tipo.data?.id ?? null;
  if (!tipoId) {
    const generico =
      v.tipo === "Análise"
        ? "Análise não especificada"
        : v.tipo === "Conteúdo"
          ? "Artigo"
          : null;
    if (generico && generico !== subtipoBase) {
      const { data: alternativo } = await supabase
        .from("tipos_entrega")
        .select("id")
        .eq("tipo", v.tipo)
        .is("subtipo", generico)
        .maybeSingle();
      tipoId = alternativo?.id ?? null;
    }
  }

  if (!tipoId || !fase.data || !decisao.data || !origem.data) {
    const faltando: string[] = [];
    if (!tipoId) {
      faltando.push(
        `tipo "${v.tipo}"${subtipoBase ? ` · ${subtipoBase}` : ""} (nem o genérico)`,
      );
    }
    if (!fase.data) faltando.push('fase "solicitada"');
    if (!decisao.data) faltando.push('decisão "pendente"');
    if (!origem.data) faltando.push('origem "app"');
    return {
      ok: false,
      erro: `Não foi possível resolver: ${faltando.join(", ")}.`,
    };
  }

  const { data, error } = await supabase
    .from("entregas")
    .insert({
      cliente_id: clienteId,
      tipo_entrega_id: tipoId,
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
// Edição de entrega existente (admin/gestor; operador só muda a situação)
// ---------------------------------------------------------------------------

export type ResultadoEdicao = { ok: false; erro: string } | { ok: true };

function exigeEdicao(perfil: { papel: string } | null): boolean {
  return Boolean(perfil && ["admin", "gestor"].includes(perfil.papel));
}

export async function atualizarEntrega(
  entrada: Record<string, unknown>,
): Promise<ResultadoEdicao> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou. Entre novamente." };

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel, nome")
    .eq("id", user.id)
    .maybeSingle();

  if (!exigeEdicao(perfil) || !perfil) {
    return { ok: false, erro: "Apenas admin e gestor podem editar a entrega." };
  }

  const entregaId = Number(entrada.entrega_id);
  if (!Number.isInteger(entregaId) || entregaId <= 0) {
    return { ok: false, erro: "Entrega inválida." };
  }

  const dados = schemaEdicaoEntrega.safeParse(entrada);
  if (!dados.success) {
    return { ok: false, erro: primeiroErro(dados) ?? "Dados inválidos." };
  }
  const v = dados.data;

  // A leitura respeita o RLS: operador só carrega a entrega do próprio squad.
  const { data: atual } = await supabase
    .from("entregas")
    .select("*")
    .eq("id", entregaId)
    .maybeSingle();
  if (!atual) {
    return { ok: false, erro: "Entrega não encontrada ou sem permissão." };
  }

  // Squad e responsável são dimensões: resolve pelo nome, mantém se vazio.
  let squadId: number | null = null;
  if (v.squad) {
    const { data: sq } = await supabase
      .from("squads")
      .select("id")
      .eq("nome", v.squad)
      .maybeSingle();
    squadId = sq?.id ?? null;
  }
  let pessoaId: number | null = null;
  if (v.responsavel) {
    const { data: pe } = await supabase
      .from("pessoas")
      .select("id")
      .eq("nome", v.responsavel)
      .maybeSingle();
    pessoaId = pe?.id ?? null;
  }

  const numRevisoes = v.num_revisoes === "" ? null : Number(v.num_revisoes);

  const { error } = await supabase
    .from("entregas")
    .update({
      titulo: v.titulo,
      data_prevista_id: v.data_prevista || null,
      data_entrega_id: v.data_entrega || null,
      num_revisoes: numRevisoes,
      link: v.link || null,
      observacoes: v.observacoes || null,
      squad_id: squadId,
      pessoa_id: pessoaId,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", entregaId);

  if (error) {
    return { ok: false, erro: `Não foi possível salvar: ${error.message}` };
  }

  // Histórico: um evento por campo que de fato mudou.
  const campos: [string, unknown, unknown][] = [
    ["titulo", atual.titulo, v.titulo],
    ["data_prevista", atual.data_prevista_id, v.data_prevista || null],
    ["data_entrega", atual.data_entrega_id, v.data_entrega || null],
    ["num_revisoes", atual.num_revisoes, numRevisoes],
    ["link", atual.link, v.link || null],
    ["observacoes", atual.observacoes, v.observacoes || null],
    ["squad_id", atual.squad_id, squadId],
    ["pessoa_id", atual.pessoa_id, pessoaId],
  ];
  const autor = perfil.nome || "Usuário";
  for (const [campo, antigo, novo] of campos) {
    if (String(antigo ?? "") !== String(novo ?? "")) {
      await supabase.from("eventos_entrega").insert({
        entrega_id: entregaId,
        tipo_evento: "campo",
        campo,
        valor_antigo: antigo == null ? null : String(antigo),
        valor_novo: novo == null ? null : String(novo),
        autor,
        origem_id: atual.origem_id,
      });
    }
  }

  revalidatePath("/inicio");
  revalidatePath("/entregas");
  revalidatePath(`/entregas/${entregaId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Alteração de situação (status) — operador pode mudar a fase
// ---------------------------------------------------------------------------

export async function alterarFaseEntrega(
  entregaId: number,
  faseId: number,
): Promise<ResultadoEdicao> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel, nome")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !["admin", "gestor", "operador"].includes(perfil.papel)) {
    return { ok: false, erro: "Seu perfil só pode consultar." };
  }

  const { data: atual } = await supabase
    .from("entregas")
    .select("fase_id")
    .eq("id", entregaId)
    .maybeSingle();
  if (!atual) return { ok: false, erro: "Entrega não encontrada ou sem permissão." };
  if (atual.fase_id === faseId) return { ok: true };

  const { data: fase } = await supabase
    .from("fases")
    .select("codigo, rotulo")
    .eq("id", faseId)
    .maybeSingle();
  if (!fase) return { ok: false, erro: "Situação inválida." };

  const { error } = await supabase
    .from("entregas")
    .update({ fase_id: faseId, atualizado_em: new Date().toISOString() })
    .eq("id", entregaId);
  if (error) return { ok: false, erro: error.message };

  const { data: antiga } = await supabase
    .from("fases")
    .select("codigo")
    .eq("id", atual.fase_id)
    .maybeSingle();
  await supabase.from("eventos_entrega").insert({
    entrega_id: entregaId,
    tipo_evento: "fase",
    campo: "fase",
    valor_antigo: antiga?.codigo ?? String(atual.fase_id),
    valor_novo: fase.codigo,
    autor: perfil.nome,
  });

  revalidatePath(`/entregas/${entregaId}`);
  revalidatePath("/entregas");
  return { ok: true };
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

  // E-mail automático ao cliente com o link (D). O link existe de qualquer
  // forma: se o cliente não tiver e-mail cadastrado, ou o provedor recusar o
  // envio, a tela mostra o motivo e o link continua disponível para copiar.
  const url = `${await urlBase()}/aprovacao/${data}`;
  const envio: {
    status: "enviado" | "sem_email" | "falhou";
    destino?: string;
    erro?: string;
    modoTeste?: boolean;
    enderecoPermitido?: string;
  } = { status: "sem_email" };

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
        url,
        validadeDias: 7,
      });
      const r = await enviarEmail({
        para: cli.email,
        ...tpl,
        tipo: "link_aprovacao",
        entidadeId: entregaId,
      });
      envio.status = r.ok ? "enviado" : "falhou";
      envio.destino = cli.email;
      if (!r.ok) {
        envio.erro = r.erro;
        envio.modoTeste = r.modoTeste;
        envio.enderecoPermitido = r.enderecoPermitido;
      }
    }
  }

  const retorno = new URLSearchParams({ token_criado: data, email: envio.status });
  if (envio.destino) retorno.set("email_destino", envio.destino);
  if (envio.erro) retorno.set("email_erro", envio.erro.slice(0, 240));
  if (envio.modoTeste) retorno.set("email_teste", "1");
  if (envio.enderecoPermitido) retorno.set("email_liberado", envio.enderecoPermitido);

  redirect(`/entregas/${entregaId}?${retorno.toString()}`);
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

  // Limite de tentativas por token + IP: o token já é de uso único, mas sem
  // isso um link válido pode ser alvo de força bruta.
  const limite = await verificarLimite(chaveDeIp(`aprovacao:${token}`, ip), 10, 900);
  if (!limite.permitido) {
    return {
      ok: false,
      mensagem: "Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.",
    };
  }

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

  const { data: ent } = await admin
    .from("entregas_detalhadas")
    .select("cliente")
    .eq("id", data.entrega_id)
    .maybeSingle();
  const cliente = ent?.cliente ?? "Cliente";

  // Avisa o time por e-mail sobre a decisão do cliente (D).
  const equipe = process.env.EMAIL_EQUIPE;
  if (equipe) {
    const tpl = emailDecisaoCliente({
      titulo: data.titulo,
      cliente,
      etapa: data.etapa,
      decisao,
      autor: autorNome,
      observacao: observacao ?? null,
    });
    await enviarEmail({ para: equipe, ...tpl, tipo: "decisao_cliente", entidadeId: data.entrega_id });
  }

  // Comprovante automático para quem aprovou (D). Se o cliente não tiver
  // e-mail cadastrado, usa o endereço informado no formulário.
  let destinoCliente = autorEmail?.trim() ?? null;
  if (ent?.cliente) {
    const { data: cli } = await admin
      .from("clientes")
      .select("email")
      .eq("nome", ent.cliente)
      .maybeSingle();
    destinoCliente = cli?.email ?? destinoCliente;
  }
  if (destinoCliente) {
    const tpl = emailComprovante({
      cliente,
      titulo: data.titulo,
      etapa: data.etapa,
      decisao,
      autor: autorNome,
    });
    await enviarEmail({
      para: destinoCliente,
      ...tpl,
      tipo: "comprovante_aprovacao",
      entidadeId: data.entrega_id,
    });
  }

  return {
    ok: true,
    mensagem:
      decisao === "recusada"
        ? "Ajuste solicitado. O time da Conversion vai reavaliar e devolver o prazo."
        : "Obrigado! A aprovação foi registrada no histórico da entrega e o time vê a decisão no app.",
    fase: data.fase,
  };
}