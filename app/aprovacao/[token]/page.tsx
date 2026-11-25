import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
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
          </div>

          <FormularioAprovacao dados={dados} />
        </>
      )}

      <footer className="muted">
        Aprovações ficam registradas com autor e data — nada se perde no
        e-mail.
      </footer>
    </main>
  );
}
