"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cadastrarEntrega } from "../actions";

type Cliente = { id: number; nome: string };
type Campos = Record<string, string>;

export function FormularioNovaEntrega({
  clientes,
  tipos,
}: {
  clientes: Cliente[];
  tipos: string[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Campos>({});

  function enviar(formulario: FormData) {
    setErro(null);
    setCampos({});
    const entrada = Object.fromEntries(formulario.entries());
    iniciar(async () => {
      const resultado = await cadastrarEntrega(entrada);
      if (resultado.ok) {
        router.push(`/entregas/${resultado.id}`);
        router.refresh();
        return;
      }
      setErro(resultado.erro);
      if (resultado.campos) setCampos(resultado.campos);
    });
  }

  return (
    <form action={enviar} className="cartao-form">
      {erro && (
        <p className="erro" role="alert">
          {erro}
        </p>
      )}

      <label>
        Título *
        <input name="titulo" required minLength={3} placeholder="Relatório mensal 12/2026" />
        {campos.titulo && <span className="erro-campo">{campos.titulo}</span>}
      </label>

      <label>
        Cliente *
        <select name="cliente_id" defaultValue="" required>
          <option value="" disabled>
            Selecione…
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Novo cliente (opcional — cria um registro novo)
        <input name="novo_cliente" placeholder="Nome canônico do cliente" />
      </label>

      <label>
        Tipo *
        <select name="tipo" defaultValue="Relatório" required>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label>
        Subtipo (opcional)
        <input name="subtipo" placeholder="Ex.: Core Web Vitals" />
      </label>

      <label>
        Data de solicitação
        <input type="date" name="data_solicitacao" />
      </label>

      <label>
        Data prevista
        <input type="date" name="data_prevista" />
      </label>

      <label>
        Squad
        <input name="squad" placeholder="Squad Azul" />
      </label>

      <label>
        Responsável
        <input name="responsavel" placeholder="Ana" />
      </label>

      <label>
        Link do arquivo (Drive)
        <input name="link" type="url" placeholder="https://drive.google.com/…" />
      </label>

      <label className="coluna">
        Observações
        <textarea name="observacoes" rows={3} />
      </label>

      <p className="muted">
        A entrega nasce na fase <strong>Solicitada</strong>. O link de
        aprovação do planejamento é gerado na tela da entrega.
      </p>

      <div className="botoes">
        <button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Cadastrar entrega"}
        </button>
        <button
          type="reset"
          className="secundario"
          onClick={() => {
            setErro(null);
            setCampos({});
          }}
        >
          Limpar
        </button>
      </div>
    </form>
  );
}