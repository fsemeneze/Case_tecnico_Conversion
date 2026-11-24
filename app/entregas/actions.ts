"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

const TIPOS = ["Relatório", "Análise", "Conteúdo"] as const;

// ---------------------------------------------------------------------------
// Cadastro de entrega (time, com sessão — RLS `authenticated` aplica)
// ---------------------------------------------------------------------------

export async function cadastrarEntrega(formulario: FormData) {
  const supabase = await criarClienteSupabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const titulo = String(formulario.get("titulo") ?? "").trim();
  const tipo = String(formulario.get("tipo") ?? "");
  const novoCliente = String(formulario.get("novo_cliente") ?? "").trim();
  const clienteId = formulario.get("cliente_id");

  if (!titulo) redirect("/entregas/nova?erro=Informe+o+título+da+entrega");
  if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) {
    redirect("/entregas/nova?erro=Tipo+inválido");
  }

  let idCliente: number;
  if (novoCliente) {
    const { data: cliente, error: erroCliente } = await supabase
      .from("clientes")
      .insert({ nome: novoCliente })
      .select("id")
      .single();
    if (erroCliente) {
      redirect(`/entregas/nova?erro=${encodeURIComponent(erroCliente.message)}`);
    }
    idCliente = cliente.id;
  } else {
    idCliente = Number(clienteId);
    if (!idCliente) {
      redirect("/entregas/nova?erro=Selecione+um+cliente+ou+informe+um+nome");
    }
  }

  const registro = {
    cliente_id: idCliente,
    titulo,
    tipo,
    subtipo: String(formulario.get("subtipo") ?? "").trim() || null,
    squad: String(formulario.get("squad") ?? "").trim() || null,
    responsavel: String(formulario.get("responsavel") ?? "").trim() || null,
    data_solicitacao: String(formulario.get("data_solicitacao") ?? "") || null,
    data_prevista: String(formulario.get("data_prevista") ?? "") || null,
    link: String(formulario.get("link") ?? "").trim() || null,
    observacoes: String(formulario.get("observacoes") ?? "").trim() || null,
    fase: "solicitada" as const,
  };

  const { data, error } = await supabase
    .from("entregas")
    .insert(registro)
    .select("id")
    .single();

  if (error) {
    redirect(`/entregas/nova?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/entregas");
  redirect(`/entregas/${data.id}`);
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
