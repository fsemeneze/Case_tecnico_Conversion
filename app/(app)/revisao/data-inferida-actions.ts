"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; erro?: string };

// D17: confirma (ou corrige) a data cujo ano foi inferido na importação.
// A regra é validada no banco; a action só repassa e marca o erro como resolvido.
export async function confirmarDataInferida(
  entregaId: number,
  campo: "data_solicitacao" | "data_prevista" | "data_entrega",
  data: string,
): Promise<Resultado> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { error } = await supabase.rpc("confirmar_data_inferida", {
    p_entrega_id: entregaId,
    p_campo: campo,
    p_data: data,
  });

  if (error) return { ok: false, erro: error.message };

  await supabase
    .from("erros_importacao")
    .update({ resolvido: true, resolvido_por: user.id, resolvido_em: new Date().toISOString() })
    .eq("entrega_id", entregaId)
    .eq("codigo", `${campo}_texto_ano_inferido`);

  revalidatePath("/revisao");
  revalidatePath(`/entregas/${entregaId}`);
  return { ok: true };
}