import { redirect } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

// Porta de entrada do PlanOps: quem tem sessão vai para Início,
// quem não tem vai para o login.
export default async function PaginaRaiz() {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuario")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil) redirect("/login");
  redirect("/inicio");
}