import Link from "next/link";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { situacaoDaEntrega, ROTULO_APROVACAO } from "@/lib/fases";

// Página PÚBLICA (sem login) de acompanhamento do cliente (C).
// Read-only: mostra todas as entregas daquele cliente resolvidas pelo token.
// A função SECURITY DEFINER filtra por cliente_id — nunca expõe outro cliente.

type EntregaCliente = {
  id: number;
  titulo: string;
  tipo: string;
  subtipo: string | null;
  fase: string;
  fase_rotulo: string;
  fase_grupo: "aberta" | "final" | "cancelada";
  data_prevista: string | null;
  data_entrega: string | null;
  dias_atraso: number | null;
  link: string | null;
  aprovacao_planejamento: string;
  aprovacao_entrega: string;
};

export default async function PortalCliente({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let cliente: string | null = null;
  let entregas: EntregaCliente[] = [];
  let erro: string | null = null;

  try {
    const admin = criarClienteSupabaseAdmin();
    const { data, error } = await admin.rpc("dados_cliente_por_token", {
      p_token: token,
    });
    if (error || !data) {
      erro = error?.message ?? "Link inválido ou expirado.";
    } else {
      cliente = (data as { cliente: string }).cliente;
      entregas = (data as { entregas: EntregaCliente[] }).entregas ?? [];
    }
  } catch (e) {
    erro = e instanceof Error ? e.message : "Erro inesperado.";
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const resumo = { total: entregas.length, atrasadas: 0, emAberto: 0, aprovadas: 0 };
  for (const e of entregas) {
    if (e.fase_grupo === "aberta") resumo.emAberto++;
    if (e.fase === "aprovada") resumo.aprovadas++;
    const atrasada =
      (e.dias_atraso ?? 0) > 0 ||
      (e.fase_grupo === "aberta" && e.data_prevista && e.data_prevista < hoje);
    if (atrasada) resumo.atrasadas++;
  }

  return (
    <main className="portal">
      <Link href="/" className="marca-topo">
        <span className="marca-mark" aria-hidden="true" />
        PlanOps
      </Link>

      {erro && (
        <div className="cartao-form">
          <h2>Este link não está mais válido</h2>
          <p className="muted">{erro}</p>
          <p>Peça um novo link ao time da Conversion para acompanhar o projeto.</p>
        </div>
      )}

      {cliente && (
        <>
          <header className="topo">
            <div>
              <h1>{cliente}</h1>
              <p className="muted">Acompanhamento do projeto · somente leitura</p>
            </div>
          </header>

          <div className="stats">
            <div className="stat">
              <span className="value">{resumo.total}</span>
              <span className="label">Entregas</span>
            </div>
            <div className="stat alert">
              <span className="value">{resumo.atrasadas}</span>
              <span className="label">Em atraso</span>
            </div>
            <div className="stat">
              <span className="value">{resumo.emAberto}</span>
              <span className="label">Em aberto</span>
            </div>
            <div className="stat">
              <span className="value">{resumo.aprovadas}</span>
              <span className="label">Aprovadas</span>
            </div>
          </div>

          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Tipo</th>
                  <th>Fase</th>
                  <th>Prazo</th>
                  <th>Situação</th>
                  <th>Conteúdo</th>
                </tr>
              </thead>
              <tbody>
                {entregas.map((e) => {
                  const situ = situacaoDaEntrega(
                    { fase: e.fase, data_prevista: e.data_prevista, dias_atraso: e.dias_atraso },
                    hoje,
                  );
                  return (
                    <tr key={e.id}>
                      <td>{e.titulo}</td>
                      <td>
                        {e.tipo}
                        {e.subtipo ? ` · ${e.subtipo}` : ""}
                      </td>
                      <td>
                        <span className="badge tom-info">{e.fase_rotulo}</span>
                      </td>
                      <td>{e.data_prevista ?? "—"}</td>
                      <td>
                        <span className={`badge tom-${situ.tom}`}>{situ.rotulo}</span>
                      </td>
                      <td>
                        {e.link ? (
                          <a
                            href={e.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="botao secundario"
                          >
                            Ver
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {entregas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      Nenhuma entrega para este cliente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="muted">
            Aprovações pendentes aparecem com a fase “{ROTULO_APROVACAO.pendente}”.
            O time envia o link de aprovação quando chega a hora de decidir.
          </p>
        </>
      )}

      <footer className="muted">
        Acompanhamento somente leitura. Nenhuma alteração é feita por este link.
      </footer>
    </main>
  );
}