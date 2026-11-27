"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { alterarFaseEntrega } from "../actions";

export function AlterarSituacao({
  entregaId,
  faseAtualId,
  faseAtualCodigo,
  fases,
}: {
  entregaId: number;
  faseAtualId: number;
  faseAtualCodigo: string;
  fases: { id: number; codigo: string; rotulo: string }[];
}) {
  const router = useRouter();
  const [faseId, setFaseId] = useState(String(faseAtualId));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Entrega aprovada/entregue não muda mais de situação: a decisão do
  // cliente é final. Voltar exige cancelar via fila de encerramento ou
  // recusar por novo link — não um clique no seletor.
  const bloqueada = ["aprovada", "entregue"].includes(faseAtualCodigo);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setPendente(true);
    const r = await alterarFaseEntrega(entregaId, Number(faseId));
    setPendente(false);
    if (r.ok) {
      setSalvo(true);
      router.refresh();
    } else {
      setErro(r.erro);
    }
  }

  if (salvo) return <span className="muted">Situação atualizada.</span>;

  if (bloqueada) {
    return (
      <p className="muted">
        Situação final — a entrega foi {faseAtualCodigo === "aprovada" ? "aprovada" : "entregue"}.
        Não é possível alterar manualmente.
      </p>
    );
  }

  return (
    <form onSubmit={enviar} className="form-linha">
      <label>
        Situação
        <select value={faseId} onChange={(e) => setFaseId(e.target.value)}>
          {fases.map((f) => (
            <option key={f.id} value={f.id}>
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