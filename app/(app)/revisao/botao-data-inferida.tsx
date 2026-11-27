"use client";

import { useState, useTransition } from "react";
import { confirmarDataInferida } from "./data-inferida-actions";

type Campo = "data_solicitacao" | "data_prevista" | "data_entrega";

const ROTULO: Record<Campo, string> = {
  data_solicitacao: "solicitação",
  data_prevista: "previsão",
  data_entrega: "entrega",
};

export function BotaoDataInferida({
  entregaId,
  campo,
  dataAtual,
}: {
  entregaId: number;
  campo: Campo;
  dataAtual: string | null;
}) {
  const [data, setData] = useState(dataAtual ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!data) {
      setErro("Informe a data.");
      return;
    }
    iniciar(async () => {
      const r = await confirmarDataInferida(entregaId, campo, data);
      if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
      else setSalvo(true);
    });
  }

  if (salvo) return <span className="muted">Data confirmada.</span>;

  return (
    <form onSubmit={confirmar} className="data-inferida-form">
      <label>
        {ROTULO[campo]}
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </label>
      <button type="submit" disabled={pendente}>
        {pendente ? "…" : "Confirmar"}
      </button>
      {erro && <span className="erro-campo">{erro}</span>}
    </form>
  );
}