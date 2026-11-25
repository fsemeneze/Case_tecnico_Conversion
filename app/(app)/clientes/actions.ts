"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

// Gera o link público de acompanhamento do cliente (C). Só admin/gestor.
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
  redirect(`/clientes?link_cliente=${data}`);
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