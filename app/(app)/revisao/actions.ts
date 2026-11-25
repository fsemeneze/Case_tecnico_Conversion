"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; erro?: string };

export async function resolverErro(id: string, resolvido: boolean): Promise<Resultado> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !["admin", "gestor", "operador"].includes(perfil.papel)) {
    return { ok: false, erro: "Seu perfil só pode consultar." };
  }

  const { error } = await supabase
    .from("erros_importacao")
    .update({
      resolvido,
      resolvido_por: resolvido ? user.id : null,
      resolvido_em: resolvido ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/revisao");
  return { ok: true };
}