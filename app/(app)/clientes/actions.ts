"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { enviarEmail, emailPortalCliente } from "@/lib/email";

function urlBase() {
  return (async () => {
    const cabecalhos = await headers();
    const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
    const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
    return `${protocolo}://${host}`;
  })();
}

// Gera o link público de acompanhamento do cliente (C). Só admin/gestor.
// Envia por e-mail quando o cliente tem endereço cadastrado; a caixa com o
// link continua aparecendo para copiar em qualquer caso.
export async function gerarAcessoCliente(formulario: FormData) {
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
    redirect("/clientes?erro=Seu+perfil+não+pode+gerar+links+de+acompanhamento");
  }

  const clienteId = Number(formulario.get("cliente_id"));
  if (!clienteId) redirect("/clientes");

  const admin = criarClienteSupabaseAdmin();
  const { data, error } = await admin.rpc("criar_acesso_cliente", {
    p_cliente_id: clienteId,
    p_validade_dias: 90,
  });

  if (error || !data) {
    redirect(
      `/clientes?erro=${encodeURIComponent(
        error?.message ?? "Não foi possível gerar o link.",
      )}`,
    );
  }

  revalidatePath("/clientes");

  // E-mail ao cliente (D). O envio nunca derruba a geração do link.
  const url = `${await urlBase()}/cliente/${data}`;
  const retorno = new URLSearchParams({ link_cliente: data });

  const { data: cliente } = await admin
    .from("clientes")
    .select("nome, email")
    .eq("id", clienteId)
    .maybeSingle();

  if (cliente?.email) {
    const tpl = emailPortalCliente({
      cliente: cliente.nome,
      url,
      validadeDias: 90,
    });
    const r = await enviarEmail({
      para: cliente.email,
      ...tpl,
      tipo: "portal_cliente",
      entidadeId: clienteId,
    });
    retorno.set("email", r.ok ? "enviado" : "falhou");
    retorno.set("email_destino", cliente.email);
    if (!r.ok) {
      retorno.set("email_erro", (r.erro ?? "").slice(0, 240));
      if (r.modoTeste) retorno.set("email_teste", "1");
      if (r.enderecoPermitido) retorno.set("email_liberado", r.enderecoPermitido);
    }
  } else {
    retorno.set("email", "sem_email");
  }

  redirect(`/clientes?${retorno.toString()}`);
}

// ---------------------------------------------------------------------------
// Cadastro e edição de clientes (só admin; a RLS também exige admin na escrita)
// ---------------------------------------------------------------------------

function valor(formulario: FormData, chave: string): string {
  const v = formulario.get(chave);
  return typeof v === "string" ? v.trim() : "";
}

function exigeAdmin(perfil: { papel: string } | null, destino: string): void {
  if (!perfil || perfil.papel !== "admin") {
    redirect(`${destino}?erro=Apenas+administradores+podem+cadastrar+ou+editar+clientes`);
  }
}

export async function criarCliente(formulario: FormData) {
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
  exigeAdmin(perfil, "/clientes/novo");

  const nome = valor(formulario, "nome");
  if (nome.length < 2) {
    redirect(`/clientes/novo?erro=${encodeURIComponent("Informe o nome do cliente.")}`);
  }

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      nome_fantasia: valor(formulario, "nome_fantasia") || null,
      cnpj: valor(formulario, "cnpj") || null,
      email: valor(formulario, "email") || null,
      telefone: valor(formulario, "telefone") || null,
      cidade: valor(formulario, "cidade") || null,
      uf: valor(formulario, "uf") || null,
      contato_nome: valor(formulario, "contato_nome") || null,
      observacoes: valor(formulario, "observacoes") || null,
      ativo: formulario.get("ativo") === "on",
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/clientes/novo?erro=${encodeURIComponent(error?.message ?? "Não foi possível criar o cliente.")}`);
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}?ok=Cliente+criado`);
}

export async function atualizarCliente(formulario: FormData) {
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

  const id = Number(valor(formulario, "id"));
  if (!id) redirect("/clientes");
  exigeAdmin(perfil, `/clientes/${id}`);

  const nome = valor(formulario, "nome");
  if (nome.length < 2) {
    redirect(`/clientes/${id}?erro=${encodeURIComponent("Informe o nome do cliente.")}`);
  }

  const { error } = await supabase
    .from("clientes")
    .update({
      nome,
      nome_fantasia: valor(formulario, "nome_fantasia") || null,
      cnpj: valor(formulario, "cnpj") || null,
      email: valor(formulario, "email") || null,
      telefone: valor(formulario, "telefone") || null,
      cidade: valor(formulario, "cidade") || null,
      uf: valor(formulario, "uf") || null,
      contato_nome: valor(formulario, "contato_nome") || null,
      observacoes: valor(formulario, "observacoes") || null,
      ativo: formulario.get("ativo") === "on",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirect(`/clientes/${id}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?ok=Cliente+atualizado`);
}