import { NextResponse } from "next/server";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Batida diária do Vercel Cron (vercel.json) para o projeto Supabase Free não
// ser pausado por inatividade: sem uso por 7 dias, o Supabase pausa o banco e
// o app sai do ar. A consulta é mínima e não expõe dado nenhum.
export async function GET() {
  const admin = criarClienteSupabaseAdmin();
  const { error } = await admin.from("fases").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, erro: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, em: new Date().toISOString() });
}
