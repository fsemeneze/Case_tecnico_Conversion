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