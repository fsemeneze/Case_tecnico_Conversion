import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { ROTULO_APROVACAO } from "@/lib/fases";
import { FormularioAprovacao, type DadosEntrega } from "./formulario-aprovacao";

// Página PÚBLICA (sem login) de aprovação via token (D3).
// Resolve a entrega pendente do token pela função SECURITY DEFINER.
export default async function PaginaAprovacao({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let dados: DadosEntrega | null = null;
  let erroToken: string | null = null;

  try {
    const admin = criarClienteSupabaseAdmin();
    const { data, error } = await admin.rpc("dados_entrega_por_token", {
      p_token: token,
    });
    if (error || !data) {
      erroToken =
        error?.message ?? "Token inválido, expirado ou já utilizado.";
    } else {
      dados = data as DadosEntrega;
    }
  } catch (e) {
    erroToken = e instanceof Error ? e.message : "Erro inesperado.";
  }

  return (
    <main className="aprovacao">
      <a href="/" className="marca-topo">
        <span className="marca-mark" aria-hidden="true" />
        PlanOps
      </a>

      {erroToken && (
        <div className="cartao-form">
          <h2>Este link não está mais válido</h2>
          <p className="muted">{erroToken}</p>
          <p>
            Se ainda precisa aprovar, peça um novo link ao time da Conversion —
            cada etapa recebe um link próprio.
          </p>
        </div>
      )}

      {dados && (
        <>
          <div className="cartao-form">
            <h2>{dados.titulo}</h2>
            <p className="muted">
              {dados.cliente} · {dados.tipo}
              {dados.etapa === "planejamento"
                ? " · etapa 1 de 2: planejamento"
                : " · etapa 2 de 2: entrega"}
            </p>
            <ul className="lista-chave">
              <li>
                <span>Prazo</span>
                <strong>{dados.data_prevista ?? "—"}</strong>
              </li>
              {dados.num_revisoes !== null && (
                <li>
                  <span>Revisões anteriores</span>
                  <strong>{dados.num_revisoes}</strong>
                </li>
              )}
            </ul>
            {dados.link && (
              <a
                href={dados.link}
                target="_blank"
                rel="noopener noreferrer"
                className="botao primario"
              >
                Ver conteúdo da entrega
              </a>
            )}
          </div>

          <FormularioAprovacao dados={dados} />

          <div className="cartao-form">
            <h2>O que acontece depois</h2>
            <p className="muted">
              {dados.etapa === "planejamento"
                ? "Depois da aprovação do planejamento, o squad segue para produção. Quando ficar pronto, você recebe um novo link para aprovar a entrega final."
                : "Depois da aprovação da entrega, o trabalho é encerrado. Se você pedir ajuste, o time reavalia e devolve um novo prazo."}
            </p>
          </div>

          {dados.outras_pendencias.length > 0 && (
            <div className="cartao-form">
              <h2>Outras entregas aguardando você</h2>
              <ul className="lista-chave">
                {dados.outras_pendencias.map((p) => (
                  <li key={p.id}>
                    <span>{p.titulo}</span>
                    <strong>{p.data_prevista ?? "—"}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dados.aprovacoes.length > 0 && (
            <div className="cartao-form">
              <h2>Aprovações registradas</h2>
              <ul className="linha-tempo">
                {dados.aprovacoes.map((a, i) => (
                  <li key={i}>
                    <strong>{a.etapa}</strong>: {ROTULO_APROVACAO[a.decisao] ?? a.decisao}{" "}
                    por {a.autor_nome}
                    {a.observacao ? ` — “${a.observacao}”` : ""}{" "}
                    <span className="muted">
                      {new Date(a.criado_em).toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dados.historico.length > 0 && (
            <div className="cartao-form">
              <h2>Histórico da entrega</h2>
              <ul className="linha-tempo">
                {dados.historico.map((h, i) => (
                  <li key={i}>
                    <strong>{h.tipo_evento}</strong>
                    {h.campo ? ` · ${h.campo}` : ""}: {h.valor_antigo ?? "(vazio)"} →{" "}
                    {h.valor_novo ?? "(vazio)"}{" "}
                    <span className="muted">
                      {new Date(h.criado_em).toLocaleString("pt-BR")} · {h.autor ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <footer className="muted">
        Aprovações ficam registradas com autor e data — nada se perde no
        e-mail.
      </footer>
    </main>
  );
}
