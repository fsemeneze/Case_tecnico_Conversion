"use server";

import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

export type Resultado = { ok: boolean; erro?: string };

// Encerramento de entrega parada (D13): retomar, entregar ou cancelar.
// A regra (fase aberta, vencida há mais de 90 dias, perfil admin/gestor)
// é validada no banco, dentro da função — a action só repassa.
export async function encerrarEntrega(
  entregaId: number,
  decisao: "retomada" | "entregue" | "cancelada",
  motivo: string,
  novoPrazo: string | null,
): Promise<Resultado> {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sua sessão expirou." };

  const { data, error } = await supabase.rpc("encerrar_entrega", {
    p_entrega_id: entregaId,
    p_decisao: decisao,
    p_motivo: motivo,
    p_novo_prazo: novoPrazo || null,
  });

  if (error) return { ok: false, erro: error.message };

  revalidatePath("/revisao");
  revalidatePath("/inicio");
  revalidatePath("/entregas");
  revalidatePath(`/entregas/${entregaId}`);
  return { ok: true };
}