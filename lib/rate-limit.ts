import { createHash } from "node:crypto";
import { criarClienteSupabaseAdmin } from "./supabase/admin";

// Limite de tentativas guardado no banco (aprovacao_priv.rate_limits), para
// funcionar em serverless sem memória compartilhada entre instâncias.
//
// Se a migration 0025 não estiver aplicada, a função não existe e liberamos
// (fail open): o app não pode ficar mais restrito do que o banco permite.
export async function verificarLimite(
  chave: string,
  limite: number,
  janelaSegundos: number,
): Promise<{ permitido: boolean }> {
  try {
    const admin = criarClienteSupabaseAdmin();
    const { data, error } = await admin.rpc("verificar_rate_limit", {
      p_chave: chave,
      p_limite: limite,
      p_janela_segundos: janelaSegundos,
    });
    if (error || !data) return { permitido: true };
    const resultado = data as { permitido?: boolean };
    return { permitido: resultado.permitido !== false };
  } catch {
    return { permitido: true };
  }
}

// Chave estável sem guardar e-mail ou IP em claro.
export function chaveDeIp(escopo: string, ip: string | null): string {
  return createHash("sha256")
    .update(`${escopo}:${ip ?? "sem-ip"}`)
    .digest("hex")
    .slice(0, 40);
}