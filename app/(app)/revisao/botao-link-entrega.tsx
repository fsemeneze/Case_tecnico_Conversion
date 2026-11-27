"use client";

import { useState, useTransition } from "react";
import { preencherLinkEntrega } from "./link-entrega-actions";

export function BotaoLinkEntrega({ entregaId }: { entregaId: number }) {
  const [link, setLink] = useState("");
  const [naoSei, setNaoSei] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciar] = useTransition();

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!naoSei && !link) {
      setErro("Informe o link ou marque que não tem.");
      return;
    }
    iniciar(async () => {
      const r = await preencherLinkEntrega(entregaId, link || null, naoSei);
      if (!r.ok) setErro(r.erro ?? "Não foi possível salvar.");
      else setSalvo(true);
    });
  }

  if (salvo) {
    return <span className="muted">Link registrado.</span>;
  }

  return (
    <form onSubmit={confirmar} className="link-entrega-form">
      <label>
        Link do arquivo
        <input
          type="url"
          placeholder="https://drive.google.com/..."
          value={link}
          disabled={naoSei}
          onChange={(e) => setLink(e.target.value)}
        />
      </label>
      <label className="filtro-check">
        <input
          type="checkbox"
          checked={naoSei}
          onChange={(e) => setNaoSei(e.target.checked)}
        />
        Não tem arquivo
      </label>
      <button type="submit" disabled={pendente}>
        {pendente ? "…" : "Salvar"}
      </button>
      {erro && <span className="erro-campo">{erro}</span>}
    </form>
  );
}