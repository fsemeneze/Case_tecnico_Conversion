import { createClient } from "@supabase/supabase-js";

// Cliente com service_role: SOMENTE em rotas de servidor, para chamar as
// funções SECURITY DEFINER do schema privado (tokens de aprovação).
// Nunca importar em código que roda no navegador.
export function criarClienteSupabaseAdmin() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada (rode via .env.local).",
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRole,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
