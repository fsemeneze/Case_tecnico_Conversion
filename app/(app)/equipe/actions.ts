"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

export type ResultadoEquipe = { ok: boolean; erro?: string };

const PAPEIS = ["admin", "gestor", "operador", "leitor"] as const;

export async function convidarUsuario(
  email: string,
  papel: string,
  squadId: number | null,
): Promise<ResultadoEquipe> {
  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number])) {
    return { ok: false, erro: "Papel inválido." };
  }

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
  if (perfil?.papel !== "admin") {
    return { ok: false, erro: "Só o administrador convida pessoas." };
  }

  const admin = criarClienteSupabaseAdmin();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { papel },
  });
  if (error) return { ok: false, erro: error.message };

  await supabase.from("convite").insert({
    email,
    papel,
    squad_id: squadId,
    convocado_por: user.id,
  });

  revalidatePath("/equipe");
  return { ok: true };
}

// Squad do usuário (admin). O RLS do banco também exige admin.
export async function alterarSquad(
  usuarioId: string,
  squadId: number | null,
): Promise<ResultadoEquipe> {
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
  if (perfil?.papel !== "admin") {
    return { ok: false, erro: "Só o administrador altera o squad." };
  }

  const { error } = await supabase
    .from("usuario")
    .update({ squad_id: squadId })
    .eq("id", usuarioId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/equipe");
  return { ok: true };
}

export async function alterarPapel(
  usuarioId: string,
  papel: string,
): Promise<ResultadoEquipe> {
  if (!PAPEIS.includes(papel as (typeof PAPEIS)[number])) {
    return { ok: false, erro: "Papel inválido." };
  }

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
  if (perfil?.papel !== "admin") {
    return { ok: false, erro: "Só o administrador altera papéis." };
  }

  const { error } = await supabase
    .from("usuario")
    .update({ papel })
    .eq("id", usuarioId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/equipe");
  return { ok: true };
}

export async function alternarAtivo(
  usuarioId: string,
  ativo: boolean,
): Promise<ResultadoEquipe> {
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
  if (perfil?.papel !== "admin") {
    return { ok: false, erro: "Só o administrador desativa contas." };
  }
  if (usuarioId === user.id && !ativo) {
    return { ok: false, erro: "Você não pode desativar a própria conta." };
  }

  const { error } = await supabase
    .from("usuario")
    .update({ ativo })
    .eq("id", usuarioId);
  if (error) return { ok: false, erro: error.message };

  revalidatePath("/equipe");
  return { ok: true };
}