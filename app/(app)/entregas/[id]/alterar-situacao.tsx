"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alterarFaseEntrega } from "../actions";

type Fase = { id: number; codigo: string; rotulo: string };

export function AlterarSituacao({
  entregaId,
  faseAtual,
  fases,
}: {
  entregaId: number;
  faseAtual: string;
  fases: Fase[];
}) {
  const router = useRouter();
  const [fase, setFase] = useState(faseAtual);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [salvo, setSalvo] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setPendente(true);
    const r = await alterarFaseEntrega(entregaId, Number(fase));
    setPendente(false);
    if (r.ok) {
      setSalvo(true);
      router.refresh();
    } else {
      setErro(r.erro);
    }
  }

  if (salvo) return <span className="muted">Situação atualizada.</span>;

  return (
    <form onSubmit={enviar} className="form-linha">
      <label>
        Situação
        <select value={fase} onChange={(e) => setFase(e.target.value)}>
          {fases.map((f) => (
            <option key={f.id} value={f.codigo}>
              {f.rotulo}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="botao primario" disabled={pendente}>
        {pendente ? "…" : "Salvar"}
      </button>
      {erro && <span className="erro-campo">{erro}</span>}
    </form>
  );
}