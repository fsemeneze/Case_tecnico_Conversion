import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { rotuloCodigo } from "@/lib/eventos";
import { BotaoResolver } from "./botao-resolver";
import { BotaoEncerrar } from "./botao-encerrar";
import { BotaoDataEntrega } from "./botao-data-entrega";
import { BotaoLinkEntrega } from "./botao-link-entrega";

type Busca = { codigo?: string; severidade?: string; status?: string };

type LinhaRevisao = {
  id: string;
  legacy_id: number | null;
  codigo: string;
  severidade: string;
  detalhe: string | null;
  resolvido: boolean;
  entrega_id: number | null;
  titulo?: string | null;
  sintetico?: boolean;
};

export default async function Revisao({ searchParams }: { searchParams: Promise<Busca> }) {
  const params = await searchParams;
  const codigo = params.codigo ?? "";
  const severidade = params.severidade ?? "";
  const status = params.status ?? "pendentes";
  const supabase = await criarClienteSupabaseServidor();

  // Fila de encerramento (D13): abertas, vencidas há mais de 90 dias e sem
  // cancelamento ativo. A elegibilidade é calculada aqui, em memória, sobre
  // as abertas com prazo — a base é pequena e a regra evita fila duplicada.
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const { data: abertas } = await supabase
    .from("entregas_detalhadas")
    .select("id, titulo, cliente, fase, fase_rotulo, data_prevista")
    .in("fase_grupo", ["aberta"])
    .lt("data_prevista", limite);
  const { data: canceladas } = await supabase
    .from("encerramentos")
    .select("entrega_id")
    .eq("decisao", "cancelada");
  const canceladasSet = new Set((canceladas ?? []).map((c) => Number(c.entrega_id)));
  const filaEncerramento = (abertas ?? []).filter(
    (e) => !canceladasSet.has(Number(e.id)),
  );

  // A fila de encerramento entra na mesma tabela dos outros problemas, como
  // linha sintética (não é erro de importação; é entrega parada).
  const encerramentoLinhas = filaEncerramento.map((e) => {
    const dias = Math.floor(
      (Date.parse(hoje) - Date.parse(String(e.data_prevista))) / 86_400_000,
    );
    return {
      id: `enc-${e.id}`,
      legacy_id: null as number | null,
      codigo: "encerramento_parada",
      severidade: "aviso",
      detalhe: `${e.cliente} · vencida há ${dias} dias`,
      resolvido: false,
      entrega_id: Number(e.id),
      titulo: String(e.titulo),
      sintetico: true,
    };
  });

  // D14: concluídas sem data de entrega (flag da importação) — o time
  // preenche a data real ou confirma que não sabe.
  const { data: semData } = await supabase
    .from("entregas_detalhadas")
    .select("id, titulo, cliente, fase_rotulo, data_prevista")
    .contains("flags", ["concluida_sem_data_entrega"])
    .not("data_entrega", "is", null)
    .limit(200);
  const { data: comData } = await supabase
    .from("entregas_detalhadas")
    .select("id")
    .contains("flags", ["concluida_sem_data_entrega"])
    .not("data_entrega", "is", null);
  const comDataSet = new Set((comData ?? []).map((e) => Number(e.id)));
  const filaSemData = (semData ?? []).filter((e) => !comDataSet.has(Number(e.id)));

  // D15: entregas sem link de arquivo — o time preenche o link ou confirma
  // ausência.
  const { data: semLink } = await supabase
    .from("entregas_detalhadas")
    .select("id, titulo, cliente, fase_rotulo")
    .is("link", null)
    .or("link.eq.")
    .limit(200);
  const filaSemLink = (semLink ?? []).filter((e: any) => {
    const flags = e.flags;
    return !Array.isArray(flags) || !flags.includes("concluida_sem_data_entrega");
  });

  let consulta = supabase
    .from("erros_importacao")
    .select("id, legacy_id, codigo, severidade, detalhe, resolvido, entrega_id", {
      count: "exact",
    });

  if (codigo) consulta = consulta.eq("codigo", codigo);
  if (severidade) consulta = consulta.eq("severidade", severidade);
  if (status === "pendentes") consulta = consulta.eq("resolvido", false);
  if (status === "resolvidos") consulta = consulta.eq("resolvido", true);

  const { data: erros, count } = await consulta
    .order("severidade", { ascending: false })
    .order("codigo")
    .limit(200);

  // Cartões com o total do filtro, não o que coube na página.
  const contar = async (sev: "critico" | "aviso") => {
    let q = supabase
      .from("erros_importacao")
      .select("id", { count: "exact", head: true })
      .eq("severidade", sev);
    if (codigo) q = q.eq("codigo", codigo);
    if (severidade) q = q.eq("severidade", severidade);
    if (status === "pendentes") q = q.eq("resolvido", false);
    if (status === "resolvidos") q = q.eq("resolvido", true);
    const { count: n } = await q;
    return n ?? 0;
  };

  const [totalCriticos, totalAvisos] = await Promise.all([
    contar("critico"),
    contar("aviso"),
  ]);

  // Encerramento entra na tabela geral quando o filtro deixa (aviso/pendentes).
  const mostrarEncerramento =
    (!severidade || severidade === "aviso") &&
    status !== "resolvidos" &&
    (!codigo || codigo === "encerramento_parada");
  const extraEncerramento = mostrarEncerramento ? encerramentoLinhas.length : 0;
  const linhasTabela: LinhaRevisao[] = [
    ...((erros ?? []) as LinhaRevisao[]),
    ...(mostrarEncerramento ? encerramentoLinhas : []),
  ];
  const totalLinhas = (count ?? 0) + extraEncerramento;

  // O seletor de tipos conta só o que está pendente: código sem pendência
  // não deve aparecer como se ainda houvesse trabalho.
  const { data: contagem } = await supabase
    .from("erros_importacao")
    .select("codigo")
    .eq("resolvido", false);

  const porCodigo = new Map<string, number>();
  for (const linha of contagem ?? []) {
    const c = String(linha.codigo);
    porCodigo.set(c, (porCodigo.get(c) ?? 0) + 1);
  }
  if (filaEncerramento.length > 0) {
    porCodigo.set("encerramento_parada", filaEncerramento.length);
  }

  const temFiltro = Boolean(codigo || severidade || status !== "pendentes");
  const parametros = (p: { codigo?: string; severidade?: string; status?: string }) => {
    const u = new URLSearchParams();
    if (p.codigo) u.set("codigo", p.codigo);
    if (p.severidade) u.set("severidade", p.severidade);
    if (p.status && p.status !== "pendentes") u.set("status", p.status);
    return u.toString();
  };

  return (
    <>
      <header className="topo">
        <div>
          <h1>Revisão de dados</h1>
        </div>
      </header>

      <p className="muted">
        Problemas encontrados na importação dos dados e entregas abertas há mais
        de 90 dias. Nada foi apagado: cada linha original está preservada na
        entrega. Marque como resolvido quando conferir.
      </p>

      {filaSemData.length > 0 && (
        <div className="cartao">
          <h2>Concluídas sem data de entrega</h2>
          <p className="muted">
            O status diz que a entrega foi concluída, mas a data de entrega está
            em branco — sem ela, o atraso e o ciclo não são calculados. Informe
            a data real ou confirme que não sabe; o app nunca inventa a data.
          </p>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Cliente</th>
                  <th>Fase</th>
                  <th>Prazo</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filaSemData.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/entregas/${e.id}`} className="titulo-link">
                        {e.titulo}
                      </Link>
                    </td>
                    <td>{e.cliente}</td>
                    <td>{e.fase_rotulo}</td>
                    <td>{e.data_prevista ?? "—"}</td>
                    <td>
                      <BotaoDataEntrega entregaId={Number(e.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filaSemLink.length > 0 && (
        <div className="cartao">
          <h2>Entregas sem link de arquivo</h2>
          <p className="muted">
            O status indica entrega concluída, mas não há link de arquivo — sem
            ele, o cliente não recebe nada pelo portal. Informe o link ou
            confirme que não tem arquivo; o app nunca inventa um link.
          </p>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Entrega</th>
                  <th>Cliente</th>
                  <th>Fase</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filaSemLink.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/entregas/${e.id}`} className="titulo-link">
                        {e.titulo}
                      </Link>
                    </td>
                    <td>{e.cliente}</td>
                    <td>{e.fase_rotulo}</td>
                    <td>
                      <BotaoLinkEntrega entregaId={Number(e.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat alert">
          <span className="value">{totalCriticos}</span>
          <span className="label">críticos</span>
        </div>
        <div className="stat">
          <span className="value">{totalAvisos + extraEncerramento}</span>
          <span className="label">avisos</span>
        </div>
        <div className="stat">
          <span className="value">{totalLinhas}</span>
          <span className="label">no total</span>
        </div>
      </div>

      <form className="filtros" method="get">
        <select name="codigo" defaultValue={codigo}>
          <option value="">Todos os tipos</option>
          {[...porCodigo.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => (
              <option key={c} value={c}>
                {rotuloCodigo(c)} ({n})
              </option>
            ))}
        </select>
        <select name="severidade" defaultValue={severidade}>
          <option value="">Todas as severidades</option>
          <option value="critico">Crítico</option>
          <option value="aviso">Aviso</option>
        </select>
        <select name="status" defaultValue={status}>
          <option value="pendentes">Pendentes</option>
          <option value="resolvidos">Resolvidos</option>
          <option value="">Todos</option>
        </select>
        <button type="submit">Filtrar</button>
        {temFiltro && (
          <Link href="/revisao" className="botao secundario">
            Limpar
          </Link>
        )}
      </form>

      <p className="muted resumo">
        {totalLinhas} registro{totalLinhas === 1 ? "" : "s"}
        {temFiltro ? " com o filtro aplicado" : ""} · mostrando até 200.
      </p>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Severidade</th>
              <th>Problema</th>
              <th>Entrega</th>
              <th>Detalhe</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {linhasTabela.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`badge tom-${e.severidade === "critico" ? "erro" : "alerta"}`}>
                    {e.severidade === "critico" ? "Crítico" : "Aviso"}
                  </span>
                </td>
                <td>{rotuloCodigo(e.codigo)}</td>
                <td>
                  {e.sintetico && e.titulo && e.entrega_id ? (
                    <Link
                      href={`/entregas/${e.entrega_id}`}
                      className="titulo-link"
                    >
                      {e.titulo}
                    </Link>
                  ) : e.entrega_id ? (
                    <Link href={`/entregas/${e.entrega_id}`} className="titulo-link">
                      #{e.entrega_id}
                    </Link>
                  ) : e.legacy_id ? (
                    <span className="muted">registro nº {e.legacy_id}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="muted">{e.detalhe ?? "—"}</td>
                <td>
                  {e.sintetico && e.entrega_id ? (
                    <BotaoEncerrar entregaId={Number(e.entrega_id)} />
                  ) : e.codigo === "concluida_sem_data_entrega" && e.entrega_id ? (
                    <BotaoDataEntrega entregaId={Number(e.entrega_id)} />
                  ) : (e.codigo === "sem_link" || e.codigo === "link_textual") && e.entrega_id ? (
                    <BotaoLinkEntrega entregaId={Number(e.entrega_id)} />
                  ) : (
                    <BotaoResolver id={e.id} resolvido={e.resolvido} />
                  )}
                </td>
              </tr>
            ))}
            {linhasTabela.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhum registro com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {parametros({}) === "" && null}
    </>
  );
}