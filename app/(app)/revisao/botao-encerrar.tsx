"use client";

import { useState, useTransition } from "react";
import { encerrarEntrega } from "./encerrar-actions";

type Decisao = "retomada" | "entregue" | "cancelada";

const ROTULO: Record<Decisao, string> = {
  retomada: "Retomar",
  entregue: "Entregar",
  cancelada: "Cancelar",
};

export function BotaoEncerrar({ entregaId }: { entregaId: number }) {
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [motivo, setMotivo] = useState("");
  const [novoPrazo, setNovoPrazo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!decisao || !motivo.trim()) return;
    setErro(null);
    if (decisao === "retomada" && !novoPrazo) {
      setErro("Informe o novo prazo.");
      return;
    }
    iniciar(async () => {
      const r = await encerrarEntrega(entregaId, decisao, motivo, novoPrazo || null);
      if (!r.ok) setErro(r.erro ?? "Não foi possível encerrar.");
      else {
        setDecisao(null);
        setMotivo("");
        setNovoPrazo("");
      }
    });
  }

  // Um gatilho só, como as outras ações da fila: o formulário abre ao clicar.
  if (decisao === null) {
    return (
      <button
        type="button"
        className="botao secundario"
        onClick={() => setDecisao("retomada")}
      >
        Encerrar
      </button>
    );
  }

  return (
    <form onSubmit={confirmar} className="form-linha">
      <label>
        Decisão
        <select
          value={decisao}
          onChange={(e) => setDecisao(e.target.value as Decisao)}
        >
          <option value="retomada">Retomar</option>
          <option value="entregue">Entregar</option>
          <option value="cancelada">Cancelar</option>
        </select>
      </label>
      <label>
        Motivo *
        <input
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={
            decisao === "cancelada"
              ? "Por que cancelar?"
              : decisao === "retomada"
                ? "O que destravou?"
                : "O que foi entregue?"
          }
        />
      </label>
      {decisao === "retomada" && (
        <label>
          Novo prazo *
          <input
            type="date"
            required
            value={novoPrazo}
            onChange={(e) => setNovoPrazo(e.target.value)}
          />
        </label>
      )}
      <span className="acao-linha">
        <button type="submit" className="botao primario" disabled={pendente}>
          {pendente ? "…" : "Confirmar"}
        </button>
        <button
          type="button"
          className="botao secundario"
          disabled={pendente}
          onClick={() => {
            setDecisao(null);
            setErro(null);
          }}
        >
          Voltar
        </button>
      </span>
      {erro && <span className="erro-campo">{erro}</span>}
    </form>
  );
}