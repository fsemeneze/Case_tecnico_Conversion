"use client";

import { useState, useTransition } from "react";
import { alterarPapel, alternarAtivo, alterarSquad } from "./actions";

const ROTULO: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
  leitor: "Leitor",
};

export function ControlesUsuario({
  id,
  papel,
  ativo,
  ehProprio,
  squads,
  squadId,
}: {
  id: string;
  papel: string;
  ativo: boolean;
  ehProprio: boolean;
  squads: { id: number; nome: string }[];
  squadId: number | null;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function trocarPapel(novo: string) {
    setErro(null);
    iniciar(async () => {
      const r = await alterarPapel(id, novo);
      if (!r.ok) setErro(r.erro ?? "Não foi possível alterar.");
    });
  }

  function trocarSquad(novo: string) {
    setErro(null);
    iniciar(async () => {
      const r = await alterarSquad(id, novo ? Number(novo) : null);
      if (!r.ok) setErro(r.erro ?? "Não foi possível alterar.");
    });
  }

  function alternar() {
    setErro(null);
    iniciar(async () => {
      const r = await alternarAtivo(id, !ativo);
      if (!r.ok) setErro(r.erro ?? "Não foi possível atualizar.");
    });
  }

  return (
    <span className="acao-linha">
      <select
        value={papel}
        disabled={pendente}
        onChange={(e) => trocarPapel(e.target.value)}
        aria-label="Papel"
      >
        {Object.entries(ROTULO).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
      <select
        value={squadId ?? ""}
        disabled={pendente}
        onChange={(e) => trocarSquad(e.target.value)}
        aria-label="Squad"
      >
        <option value="">Sem squad</option>
        {squads.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nome}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="secundario"
        disabled={pendente || ehProprio}
        onClick={alternar}
        title={ehProprio ? "Você não pode desativar a própria conta" : undefined}
      >
        {ativo ? "Desativar" : "Ativar"}
      </button>
      {erro && <span className="erro-campo">{erro}</span>}
    </span>
  );
}