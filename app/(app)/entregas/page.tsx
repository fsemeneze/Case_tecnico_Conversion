import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { ROTULO_FASE, situacaoDaEntrega } from "@/lib/fases";
import { listarEntregas, listarClientes } from "@/lib/consultas";

type Busca = {
  q?: string;
  cliente?: string;
  fase?: string;
  tipo?: string;
  situacao?: string;
  pagina?: string;
};

const TIPOS = ["Relatório", "Análise", "Conteúdo"];
const POR_PAGINA = 50;

export default async function ListaEntregas({
  searchParams,
}: {
  searchParams: Promise<Busca>;
}) {
  const params = await searchParams;
  const busca = params.q?.trim() ?? "";
  const cliente = params.cliente ?? "";
  const fase = params.fase ?? "";
  const tipo = params.tipo ?? "";
  const situacao = params.situacao ?? "";
  const pagina = Math.max(1, Number(params.pagina ?? 1) || 1);
  const hoje = new Date().toISOString().slice(0, 10);

  const supabase = await criarClienteSupabaseServidor();

  const [{ itens, total }, clientes] = await Promise.all([
    listarEntregas(supabase, {
      busca,
      clienteId: cliente ? Number(cliente) : undefined,
      fase,
      tipo,
      situacao: situacao === "atrasadas" || situacao === "vencidas" ? situacao : "",
      pagina,
      porPagina: POR_PAGINA,
    }),
    listarClientes(supabase),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const temFiltro = Boolean(busca || cliente || fase || tipo || situacao);

  const parametrosPagina = (p: number) => {
    const parametros = new URLSearchParams();
    if (busca) parametros.set("q", busca);
    if (cliente) parametros.set("cliente", cliente);
    if (fase) parametros.set("fase", fase);
    if (tipo) parametros.set("tipo", tipo);
    if (situacao) parametros.set("situacao", situacao);
    parametros.set("pagina", String(p));
    return parametros.toString();
  };

  return (
    <>
      <header className="topo">
        <div>
          <p className="eyebrow">PlanOps</p>
          <h1>Entregas</h1>
        </div>
        <div className="topo-acoes">
          <Link href="/entregas/nova" className="botao">
            + Nova entrega
          </Link>
        </div>
      </header>

      <form className="filtros" method="get">
        <input
          type="search"
          name="q"
          placeholder="Buscar por título…"
          defaultValue={busca}
        />
        <select name="cliente" defaultValue={cliente}>
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select name="fase" defaultValue={fase}>
          <option value="">Todas as fases</option>
          {Object.entries(ROTULO_FASE).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo}>
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="filtro-check">
          <input
            type="checkbox"
            name="situacao"
            value="atrasadas"
            checked={situacao === "atrasadas"}
          />
          Apenas em atraso
        </label>
        <label className="filtro-check">
          <input
            type="checkbox"
            name="situacao"
            value="vencidas"
            checked={situacao === "vencidas"}
          />
          Vencidas (em aberto)
        </label>
        <button type="submit">Filtrar</button>
        {temFiltro && (
          <Link href="/entregas" className="botao secundario">
            Limpar
          </Link>
        )}
      </form>

      <p className="muted resumo">
        {total} entrega{total === 1 ? "" : "s"}
        {temFiltro ? " com os filtros aplicados" : ""} · atraso pela definição
        única (D8): concluída após o prazo ou em aberto com prazo vencido.
      </p>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Título</th>
              <th>Cliente</th>
              <th>Tipo</th>
              <th>Fase</th>
              <th>Prazo</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((e) => {
              const situ = situacaoDaEntrega(
                {
                  fase: e.fase,
                  data_prevista: e.data_prevista,
                  dias_atraso: e.dias_atraso,
                },
                hoje,
              );
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/entregas/${e.id}`} className="titulo-link">
                      {e.titulo}
                    </Link>
                  </td>
                  <td>{e.cliente}</td>
                  <td>
                    {e.tipo}
                    {e.subtipo ? ` · ${e.subtipo}` : ""}
                  </td>
                  <td>
                    <span className={`badge tom-${situacaoTomFase(e.fase)}`}>
                      {e.fase_rotulo}
                    </span>
                  </td>
                  <td>{e.data_prevista ?? "—"}</td>
                  <td>
                    <span className={`badge tom-${situ.tom}`}>{situ.rotulo}</span>
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Nenhuma entrega com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <nav className="paginacao">
          {Array.from({ length: paginas }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/entregas?${parametrosPagina(p)}`}
              className={`botao ${p === pagina ? "" : "secundario"}`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </>
  );
}

function situacaoTomFase(fase: string): string {
  if (fase === "aprovada") return "ok";
  if (fase === "cancelada") return "neutro";
  if (
    ["ajuste_solicitado", "aguardando_cliente", "aguardando_aprovacao_entrega"].includes(fase)
  )
    return "alerta";
  return "info";
}