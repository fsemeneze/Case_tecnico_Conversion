"use server";

import { headers } from "next/headers";
import { chaveDeIp, verificarLimite } from "@/lib/rate-limit";

export type ResultadoLimite = { permitido: boolean; mensagem?: string };

// 8 tentativas por e-mail + IP em 15 minutos. O objetivo é conter enumeração
// de contas e força bruta; o Supabase Auth também tem o próprio limite.
export async function verificarLimiteLogin(
  email: string,
): Promise<ResultadoLimite> {
  const cabecalhos = await headers();
  const ip = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const chave = chaveDeIp(`login:${email.trim().toLowerCase()}`, ip);
  const { permitido } = await verificarLimite(chave, 8, 900);
  return permitido
    ? { permitido: true }
    : {
        permitido: false,
        mensagem:
          "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.",
      };
}