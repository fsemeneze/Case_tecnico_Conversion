"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { schemaEntrega, primeiroErro } from "@/lib/validacao";

const TIPOS = ["Relatório", "Análise", "Conteúdo"] as const;

// ---------------------------------------------------------------------------
// Cadastro de entrega (time, com sessão — RLS por papel aplica)
// ---------------------------------------------------------------------------

export type ResultadoCadastro =
  | { ok: false; erro: string; campos?: Record<string, string> }
  | { ok: true; id: number };

export async function cadastrarEntrega(entrada: Record<string, unknown>): Promise<ResultadoCadastro> {
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

  // Só admin, gestor e operador criam entregas.
  if (!perfil || !["admin", "gestor", "operador"].includes(perfil.papel)) {
    return { ok: false, erro: "Seu perfil só pode consultar. Peça acesso ao administrador." };
  }

  const dados = schemaEntrega.safeParse(entrada);
  if (!dados.success) {
    return { ok: false, erro: primeiroErro(dados) ?? "Dados inválidos.", campos: { titulo: primeiroErro(dados) ?? "" } };
  }
  if (!TIPOS.includes(dados.data.tipo as (typeof TIPOS)[number])) {
    return { ok: false, erro: "Tipo inválido." };
  }
  const v = dados.data;

  let idCliente: number;
  if (v.novo_cliente) {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({ nome: v.novo_cliente })
      .select("id")
      .single();
    if (error || !cliente) {
      return { ok: false, erro: `Não foi possível criar o cliente: ${error?.message ?? "erro"}` };
    }
    idCliente = cliente.id;
  } else {
    const id = Number(v.cliente_id);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, erro: "Selecione um cliente ou informe o nome de um novo." };
    }
    idCliente = id;
  }

  const { data, error } = await supabase
    .from("entregas")
    .insert({
      cliente_id: idCliente,
      titulo: v.titulo,
      tipo: v.tipo,
      subtipo: v.subtipo || null,
      squad: v.squad || null,
      responsavel: v.responsavel || null,
      data_solicitacao: v.data_solicitacao || null,
      data_prevista: v.data_prevista || null,
      link: v.link || null,
      observacoes: v.observacoes || null,
      fase: "solicitada",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: `Não foi possível salvar: ${error?.message ?? "erro"}` };
  }

  revalidatePath("/inicio");
  revalidatePath("/entregas");
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------
// Link de aprovação (time → cliente): token via função SECURITY DEFINER,
// chamada com service_role em rota de servidor
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
  redirect(`/entregas/${entregaId}?token_criado=${data}`);
}

// ---------------------------------------------------------------------------
// Aprovação via link (página pública, sem login) — DECISÃO (D3)
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

  const admin = criarClienteSupabaseAdmin();
  const { data, error } = await admin.rpc("registrar_aprovacao", {
    p_token: token,
    p_decisao: decisao,
    p_autor_nome: autorNome.trim(),
    p_autor_email: autorEmail?.trim() || null,
    p_observacao: observacao?.trim() || null,
  });

  if (error) {
    return { ok: false, mensagem: error.message };
  }

  revalidatePath("/inicio");
  revalidatePath("/entregas");
  revalidatePath(`/entregas/${data.entrega_id}`);
  return {
    ok: true,
    mensagem:
      decisao === "recusada"
        ? "Ajuste solicitado. O time da Conversion vai reavaliar e devolver o prazo."
        : "Obrigado! A aprovação foi registrada e o time recebeu a atualização.",
    fase: data.fase,
  };
}