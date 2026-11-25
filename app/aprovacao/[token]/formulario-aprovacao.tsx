"use client";

import { useState } from "react";
import { aprovarViaToken } from "@/app/(app)/entregas/actions";

export type EventoEntrega = {
  tipo_evento: string;
  campo: string | null;
  valor_antigo: string | null;
  valor_novo: string | null;
  autor: string | null;
  criado_em: string;
  fase_origem: string | null;
  fase_destino: string | null;
};

export type AprovacaoRegistrada = {
  etapa: string;
  decisao: string;
  autor_nome: string;
  autor_email: string | null;
  observacao: string | null;
  criado_em: string;
};

export type PendenciaCliente = {
  id: number;
  titulo: string;
  fase: string;
  fase_rotulo: string;
  data_prevista: string | null;
};

export type DadosEntrega = {
  entrega_id: number;
  titulo: string;
  tipo: string;
  cliente: string;
  etapa: string;
  data_prevista: string | null;
  num_revisoes: number | null;
  link: string | null;
  historico: EventoEntrega[];
  aprovacoes: AprovacaoRegistrada[];
  outras_pendencias: PendenciaCliente[];
};

type Estado = { ok: boolean; mensagem: string; fase?: string } | null;

export function FormularioAprovacao({ dados }: { dados: DadosEntrega }) {
  const [etapa, setEtapa] = useState<"decisao" | "confirmar" | "concluido">(
    "decisao",
  );
  const [decisao, setDecisao] = useState<"aprovada" | "recusada" | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [observacao, setObservacao] = useState("");
  const [aguardando, setAguardando] = useState(false);
  const [resultado, setResultado] = useState<Estado>(null);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!decisao || !nome.trim()) return;
    setAguardando(true);
    const res = await aprovarViaToken(
      new URLSearchParams(window.location.search).get("token") ??
        window.location.pathname.split("/").pop() ??
        "",
      decisao,
      nome,
      email || null,
      observacao || null,
    );
    setAguardando(false);
    setResultado(res);
    if (res.ok) setEtapa("concluido");
  }

  const rotuloEtapa =
    dados.etapa === "planejamento" ? "planejamento do conteúdo" : "entrega";

  if (etapa === "concluido" && resultado) {
    return (
      <div className="cartao-form confirmacao">
        <h2>{resultado.ok ? "Tudo certo ✅" : "Algo deu errado"}</h2>
        <p>{resultado.mensagem}</p>
        {resultado.fase && (
          <p className="muted">A entrega está agora na fase “{resultado.fase}”.</p>
        )}
      </div>
    );
  }

  return (
    <div className="cartao-form">
      {etapa === "decisao" && (
        <>
          <h2>Como você quer seguir?</h2>
          <p className="muted">
            Esta revisão é sobre o <strong>{rotuloEtapa}</strong>.
          </p>
          <div className="botoes">
            <button type="button" onClick={() => { setDecisao("aprovada"); setEtapa("confirmar"); }}>
              Aprovar
            </button>
            <button
              type="button"
              className="secundario"
              onClick={() => { setDecisao("recusada"); setEtapa("confirmar"); }}
            >
              Solicitar ajuste
            </button>
          </div>
        </>
      )}

      {etapa === "confirmar" && (
        <form onSubmit={confirmar}>
          <h2>
            {decisao === "aprovada"
              ? "Confirmar aprovação"
              : "Confirmar solicitação de ajuste"}
          </h2>
          <p className="muted">
            Registramos quem aprovou o quê — é o que faltava na planilha.
          </p>
          <label>
            Seu nome *
            <input required value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
          <label>
            E-mail (opcional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Observação (opcional)
            <textarea
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder={
                decisao === "recusada"
                  ? "O que precisa de ajuste?"
                  : "Alguma observação?"
              }
            />
          </label>
          <div className="botoes">
            <button type="submit" disabled={aguardando}>
              {aguardando ? "Registrando…" : "Confirmar"}
            </button>
            <button
              type="button"
              className="secundario"
              disabled={aguardando}
              onClick={() => { setEtapa("decisao"); setDecisao(null); }}
            >
              Voltar
            </button>
          </div>
          {resultado && !resultado.ok && (
            <p className="erro">{resultado.mensagem}</p>
          )}
        </form>
      )}
    </div>
  );
}
