import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Cliente Supabase para Server Components e Server Actions: sessão do
// usuário do time via cookies (complemento do middleware).
export async function criarClienteSupabaseServidor() {
  const lojaCookies = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return lojaCookies.getAll();
        },
        setAll(cookiesParaDefinir) {
          try {
            cookiesParaDefinir.forEach(({ name, value, options }) =>
              lojaCookies.set(name, value, options),
            );
          } catch {
            // Server Component: erro ignorável — o middleware refresca.
          }
        },
      },
    },
  );
}
