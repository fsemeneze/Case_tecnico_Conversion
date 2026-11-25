"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { enviarEmail, emailPrazoVencido } from "@/lib/email";

// Notifica por e-mail os clientes com entregas abertas e prazo vencido (D).
// Uso manual (botão no dashboard). Só admin/gestor.
export async function notificarVencidas() {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel")
    .eq("id", user.id)
    .maybeSingle();
  if (!perfil || !["admin", "gestor"].includes(perfil.papel)) {
    redirect("/dashboard?erro=Seu+perfil+não+pode+enviar+notificações");
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: vencidas } = await supabase
    .from("entregas_detalhadas")
    .select("id, titulo, cliente, data_prevista")
    .eq("fase_grupo", "aberta")
    .lt("data_prevista", hoje)
    .order("data_prevista", { ascending: true });

  const porCliente = new Map<string, { titulo: string; prazo: string; dias: number }[]>();
  for (const e of vencidas ?? []) {
    const prazo = e.data_prevista ?? hoje;
    const dias = Math.floor((Date.parse(hoje) - Date.parse(prazo)) / 86_400_000);
    const lista = porCliente.get(e.cliente) ?? [];
    lista.push({ titulo: e.titulo, prazo, dias });
    porCliente.set(e.cliente, lista);
  }

  let enviados = 0;
  let falhas = 0;
  let semEmail = 0;
  let primeiroErro: string | null = null;
  let liberado: string | null = null;
  for (const [cliente, entregas] of porCliente) {
    const { data: cli } = await supabase
      .from("clientes")
      .select("email")
      .eq("nome", cliente)
      .maybeSingle();
    if (!cli?.email) {
      semEmail++;
      continue;
    }
    const tpl = emailPrazoVencido({ cliente, entregas });
    const r = await enviarEmail({ para: cli.email, ...tpl, tipo: "prazo_vencido" });
    if (r.ok) {
      enviados++;
    } else {
      falhas++;
      primeiroErro ??= r.erro ?? null;
      if (r.modoTeste) liberado ??= r.enderecoPermitido ?? "o e-mail da conta";
    }
  }

  // O resultado vai para a tela com os números reais: quantos saíram, quantos
  // falharam e por quê. Antes, uma falha total aparecia como "0 enviados".
  const retorno = new URLSearchParams({ notificacoes: String(enviados) });
  if (falhas) retorno.set("falhas", String(falhas));
  if (semEmail) retorno.set("sem_email", String(semEmail));
  if (primeiroErro) retorno.set("erro_email", primeiroErro.slice(0, 200));
  if (liberado) retorno.set("email_liberado", liberado);

  revalidatePath("/dashboard");
  redirect(`/dashboard?${retorno.toString()}`);
}