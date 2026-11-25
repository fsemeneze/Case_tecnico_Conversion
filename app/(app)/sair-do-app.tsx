"use client";

import { useRouter } from "next/navigation";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";
import { Icone } from "@/app/icones";

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
      <Icone nome="sair" width={17} height={17} />
      Sair
    </button>
  );
}