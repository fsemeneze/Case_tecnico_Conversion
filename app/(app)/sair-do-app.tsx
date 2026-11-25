"use client";

import { useRouter } from "next/navigation";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

export default function SairDoApp() {
  const router = useRouter();

  async function sair() {
    const supabase = criarClienteSupabaseNavegador();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={sair}>
      Sair
    </button>
  );
}