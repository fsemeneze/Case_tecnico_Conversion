"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; erro?: string };

// D15: preenche o link de arquivo de uma entrega sem link.
// A regra (sem link anterior, URL válida, perfil) é validada no banco.
export async function preencherLinkEntrega(
  entregaId: number,
  link: string | null,
  naoSei: boolean,
): Promise<Resultado> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { error } = await supabase.rpc("preencher_link_entrega", {
    p_entrega_id: entregaId,
    p_link: link || null,
    p_nao_sei: naoSei,
  });

  if (error) return { ok: false, erro: error.message };

  // Marca o erro de revisão como resolvido (se houver).
  await supabase
    .from("erros_importacao")
    .update({ resolvido: true, resolvido_por: user.id, resolvido_em: new Date().toISOString() })
    .eq("entrega_id", entregaId)
    .eq("codigo", "sem_link");

  revalidatePath("/revisao");
  revalidatePath(`/entregas/${entregaId}`);
  return { ok: true };
}