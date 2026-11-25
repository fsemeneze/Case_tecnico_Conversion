"use client";

import { useEffect, useState } from "react";
import { Icone } from "@/app/icones";

type Tema = "light" | "dark";

// Alterna entre modo claro e escuro. A preferência fica em localStorage e,
// na primeira visita, o script do layout já aplicou o tema do sistema.
export function TemaToggle({ compacto = false }: { compacto?: boolean }) {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function alternar() {
    const atual: Tema =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const novo: Tema = atual === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      /* modo privado: segue sem persistir */
    }
    setTema(novo);
  }

  const escuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternar}
      className={compacto ? "tema-toggle compacto" : undefined}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      title={escuro ? "Modo claro" : "Modo escuro"}
    >
      <Icone nome={escuro ? "sol" : "lua"} width={17} height={17} />
      {!compacto && <span>{escuro ? "Modo claro" : "Modo escuro"}</span>}
    </button>
  );
}