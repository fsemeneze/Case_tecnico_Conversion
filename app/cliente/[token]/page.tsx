import Link from "next/link";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { situacaoDaEntrega } from "@/lib/fases";
import { abrirAprovacaoPeloPortal } from "./actions";

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

type PendenciaAprovacao = {
  entrega_id: number;
  titulo: string;
  etapa: "planejamento" | "entrega";
  data_prevista: string | null;
};

export default async function PortalCliente({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    erro?: string;
    q?: string;
    tipo?: string;
    situacao?: string;
  }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const erroLink = sp.erro;

  // Filtros do portal (aplicados depois da busca do token, em memória —
  // o RPC já devolve todas as entregas do cliente).
  const busca = sp.q?.trim().toLowerCase() ?? "";
  const tipoFiltro = sp.tipo ?? "";
  const situacaoFiltro = sp.situacao ?? ""; // "atrasadas" | "abertas" | "aprovadas" | ""

  let cliente: string | null = null;
  let entregas: EntregaCliente[] = [];
  let pendencias: PendenciaAprovacao[] = [];
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
      pendencias =
        (data as { pendencias_aprovacao: PendenciaAprovacao[] })
          .pendencias_aprovacao ?? [];
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

  const tiposDisponiveis = [...new Set(entregas.map((e) => e.tipo))].sort();

  const situacaoDaLinha = (e: EntregaCliente) => {
    const atrasada =
      (e.dias_atraso ?? 0) > 0 ||
      (e.fase_grupo === "aberta" && e.data_prevista && e.data_prevista < hoje);
    if (atrasada) return "atrasadas";
    if (e.fase === "aprovada") return "aprovadas";
    if (e.fase_grupo === "aberta") return "abertas";
    return "outras";
  };

  const entregasFiltradas = entregas.filter((e) => {
    if (busca && !e.titulo.toLowerCase().includes(busca)) return false;
    if (tipoFiltro && e.tipo !== tipoFiltro) return false;
    if (situacaoFiltro && situacaoDaLinha(e) !== situacaoFiltro) return false;
    return true;
  });

  const temFiltro = Boolean(busca || tipoFiltro || situacaoFiltro);

  const parametrosFiltro = (sobrescrever: Record<string, string>) => {
    const u = new URLSearchParams();
    if (busca) u.set("q", busca);
    if (tipoFiltro) u.set("tipo", tipoFiltro);
    if (situacaoFiltro) u.set("situacao", situacaoFiltro);
    for (const [chave, valor] of Object.entries(sobrescrever)) {
      if (valor) u.set(chave, valor);
      else u.delete(chave);
    }
    const s = u.toString();
    return s ? `/cliente/${token}?${s}` : `/cliente/${token}`;
  };

  return (
    <main className="portal">
      <Link href="/" className="marca-topo">
        <span className="marca-mark" aria-hidden="true" />
        PlanHub
      </Link>

      {erro && (
        <div className="cartao-form">
          <h2>Este link não está mais válido</h2>
          <p className="muted">{erro}</p>
          <p>Peça um novo link ao time da Conversion para acompanhar o projeto.</p>
        </div>
      )}

      {erroLink && <p className="erro">{erroLink}</p>}

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

          {pendencias.length > 0 && (
            <div className="cartao-form">
              <h2>Aprovações aguardando você</h2>
              <p className="muted">
                Estas entregas estão na fase de decisão. Abra para ver o
                conteúdo e aprovar ou pedir ajuste.
              </p>
              <ul className="lista-chave">
                {pendencias.map((p) => (
                  <li key={`${p.entrega_id}-${p.etapa}`}>
                    <div>
                      <strong>{p.titulo}</strong>
                      <div className="muted">
                        {p.etapa === "planejamento"
                          ? "Planejamento"
                          : "Entrega final"}
                        {p.data_prevista ? ` · prazo ${p.data_prevista}` : ""}
                      </div>
                    </div>
                    <form action={abrirAprovacaoPeloPortal}>
                      <input type="hidden" name="portal_token" value={token} />
                      <input
                        type="hidden"
                        name="entrega_id"
                        value={p.entrega_id}
                      />
                      <input type="hidden" name="etapa" value={p.etapa} />
                      <button type="submit">Abrir aprovação</button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="filtros" method="get">
            <input
              type="search"
              name="q"
              placeholder="Buscar entrega…"
              defaultValue={sp.q ?? ""}
            />
            <select name="tipo" defaultValue={tipoFiltro}>
              <option value="">Todos os tipos</option>
              {tiposDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select name="situacao" defaultValue={situacaoFiltro}>
              <option value="">Todas as situações</option>
              <option value="atrasadas">Em atraso</option>
              <option value="abertas">Em aberto</option>
              <option value="aprovadas">Aprovadas</option>
            </select>
            <button type="submit">Filtrar</button>
            {temFiltro && (
              <Link href={`/cliente/${token}`} className="botao secundario">
                Limpar
              </Link>
            )}
          </form>

          <p className="muted resumo">
            {temFiltro
              ? `${entregasFiltradas.length} de ${entregas.length} entregas com o filtro aplicado`
              : `${entregas.length} entrega${entregas.length === 1 ? "" : "s"}`}
          </p>

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
                {entregasFiltradas.map((e) => {
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
                {entregasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      {temFiltro
                        ? "Nenhuma entrega com esses filtros."
                        : "Nenhuma entrega para este cliente."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="muted">
            Quando uma entrega chega à sua vez de decidir, ela aparece em
            “Aprovações aguardando você”. Você pode abrir e decidir por aqui; o
            time também pode enviar o link por e-mail.
          </p>
        </>
      )}

      <footer className="muted">
        Acompanhamento somente leitura. Nenhuma alteração é feita por este link.
      </footer>
    </main>
  );
}