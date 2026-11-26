import { NextResponse } from "next/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Batida diária do Vercel Cron (vercel.json): mantém o projeto Supabase Free
// ativo (sem uso por 7 dias o banco pausa) e limpa as janelas antigas do
// limite de tentativas. A consulta é mínima e não expõe dado nenhum.
export async function GET() {
  const admin = criarClienteSupabaseAdmin();

  const { error } = await admin.from("fases").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }

  // Manutenção: janelas de rate limit com mais de 1 dia. Falha aqui não
  // derruba a batida — o motivo do cron existir é manter o banco vivo.
  let limpos: number | null = null;
  try {
    const { data, error: erroLimpeza } = await admin.rpc("limpar_rate_limits", {
      p_antigo_segundos: 86400,
    });
    if (!erroLimpeza) limpos = Number(data ?? 0);
  } catch {
    // Função ausente (migration 0025 não aplicada): segue o fluxo.
  }

  return NextResponse.json({
    ok: true,
    em: new Date().toISOString(),
    rate_limits_removidos: limpos,
  });
}