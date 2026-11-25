"use client";

import { useState, useTransition } from "react";
import { resolverErro } from "./actions";

export function BotaoResolver({
  id,
  resolvido,
}: {
  id: string;
  resolvido: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await resolverErro(id, !resolvido);
      if (!r.ok) setErro(r.erro ?? "Não foi possível atualizar.");
    });
  }

  return (
    <span className="acao-linha">
      <button
        type="button"
        className={resolvido ? "secundario" : ""}
        disabled={pendente}
        onClick={alternar}
      >
        {pendente ? "…" : resolvido ? "Reabrir" : "Resolver"}
      </button>
      {erro && <span className="erro-campo">{erro}</span>}
    </span>
  );
}