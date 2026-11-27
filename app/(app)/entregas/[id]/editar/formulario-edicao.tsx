"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { atualizarEntrega } from "../../actions";
import type { EntregaLista } from "@/lib/consultas";

export function FormularioEdicao({
  entrega,
  squads,
  pessoas,
}: {
  entrega: EntregaLista;
  squads: string[];
  pessoas: { nome: string; squad: string | null }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [squad, setSquad] = useState(entrega.squad ?? "");

  // Responsável filtrado pelo squad selecionado; sem squad, lista todos.
  const pessoasDoSquad = squad
    ? pessoas.filter((p) => p.squad === squad)
    : pessoas;

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setPendente(true);
    const fd = new FormData(e.currentTarget);
    const r = await atualizarEntrega({
      entrega_id: entrega.id,
      titulo: fd.get("titulo"),
      data_prevista: fd.get("data_prevista"),
      data_entrega: fd.get("data_entrega"),
      num_revisoes: fd.get("num_revisoes"),
      link: fd.get("link"),
      observacoes: fd.get("observacoes"),
      squad: fd.get("squad"),
      responsavel: fd.get("responsavel"),
    });
    setPendente(false);
    if (r.ok) {
      setSalvo(true);
      router.refresh();
    } else {
      setErro(r.erro);
    }
  }

  if (salvo) {
    return (
      <div className="cartao">
        <h2>Entrega atualizada</h2>
        <p className="muted">
          As alterações já estão no histórico da entrega, com autor e data.
        </p>
        <a href={`/entregas/${entrega.id}`} className="botao primario">
          Voltar para a entrega
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="cartao-form">
      <label>
        Título *
        <input name="titulo" required defaultValue={entrega.titulo} />
      </label>

      <label>
        Data prevista
        <input type="date" name="data_prevista" defaultValue={entrega.data_prevista ?? ""} />
      </label>

      <label>
        Data de entrega
        <input type="date" name="data_entrega" defaultValue={entrega.data_entrega ?? ""} />
      </label>

      <label>
        Número de revisões
        <input
          type="number"
          min={0}
          max={999}
          name="num_revisoes"
          defaultValue={entrega.num_revisoes ?? ""}
        />
      </label>

      <label>
        Link do arquivo
        <input
          type="url"
          name="link"
          placeholder="https://drive.google.com/..."
          defaultValue={entrega.link ?? ""}
        />
      </label>

      <label>
        Squad
        <select
          name="squad"
          value={squad}
          onChange={(e) => setSquad(e.target.value)}
        >
          <option value="">Selecione…</option>
          {squads.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label>
        Responsável
        <select name="responsavel" defaultValue={entrega.responsavel ?? ""} key={squad}>
          <option value="">Selecione…</option>
          {pessoasDoSquad.map((p) => (
            <option key={p.nome} value={p.nome}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Observações
        <textarea name="observacoes" rows={3} defaultValue={entrega.observacoes ?? ""} />
      </label>

      {erro && <p className="erro">{erro}</p>}

      <div className="botoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar alterações"}
        </button>
        <a href={`/entregas/${entrega.id}`} className="botao secundario">
          Cancelar
        </a>
      </div>
    </form>
  );
}