"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; erro?: string };

// D14: preenche a data de entrega de uma entrega concluída sem data.
// A regra (fase final, sem data anterior, perfil) é validada no banco.
export async function preencherDataEntrega(
  entregaId: number,
  data: string | null,
  naoSei: boolean,
): Promise<Resultado> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { error } = await supabase.rpc("preencher_data_entrega", {
    p_entrega_id: entregaId,
    p_data: data || null,
    p_nao_sei: naoSei,
  });

  if (error) return { ok: false, erro: error.message };

  // Marca o erro de revisão como resolvido (se houver).
  await supabase
    .from("erros_importacao")
    .update({ resolvido: true, resolvido_por: user.id, resolvido_em: new Date().toISOString() })
    .eq("entrega_id", entregaId)
    .eq("codigo", "concluida_sem_data_entrega");

  revalidatePath("/revisao");
  revalidatePath("/inicio");
  revalidatePath(`/entregas/${entregaId}`);
  return { ok: true };
}