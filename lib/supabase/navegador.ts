"use client";

import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para componentes de navegador (formulários de login).
export function criarClienteSupabaseNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
