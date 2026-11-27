"use client";

import { useState, useTransition } from "react";
import { preencherDataEntrega } from "./data-entrega-actions";
import { AcaoRevisao } from "./acao-revisao";

export function BotaoDataEntrega({ entregaId }: { entregaId: number }) {
  const [data, setData] = useState("");
  const [naoSei, setNaoSei] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!naoSei && !data) {
      setErro("Informe a data ou marque que não sabe.");
      return;
    }
    iniciar(async () => {
      const r = await preencherDataEntrega(entregaId, data || null, naoSei);
      if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
      else setSalvo(true);
    });
  }

  if (salvo) {
    return <span className="muted">Data registrada.</span>;
  }

  return (
    <AcaoRevisao rotulo="Data de entrega">
      <form onSubmit={confirmar} className="form-linha">
        <label>
          Data
          <input
            type="date"
            value={data}
            disabled={naoSei}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        <label className="filtro-check">
          <input
            type="checkbox"
            checked={naoSei}
            onChange={(e) => setNaoSei(e.target.checked)}
          />
          Não sei
        </label>
        <span className="acao-linha">
          <button type="submit" className="botao primario" disabled={pendente}>
            {pendente ? "…" : "Confirmar"}
          </button>
        </span>
        {erro && <span className="erro-campo">{erro}</span>}
      </form>
    </AcaoRevisao>
  );
}