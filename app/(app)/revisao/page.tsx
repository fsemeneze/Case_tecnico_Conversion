import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { BotaoResolver } from "./botao-resolver";

type Busca = { codigo?: string; severidade?: string; status?: string };

const CODIGOS: Record<string, string> = {
  id_duplicado: "ID repetido no arquivo original",
  possivel_duplicata: "Possível duplicata",
  link_repetido: "Link repetido",
  sem_link: "Sem link de arquivo",
  link_textual: "Link textual (não é URL)",
  data_prevista_texto_ano_inferido: "Ano inferido na data prevista",
  data_entrega_texto_ano_inferido: "Ano inferido na data de entrega",
  data_solicitacao_texto_ano_inferido: "Ano inferido na solicitação",
  data_prevista_serial_excel: "Data em serial do Excel",
  data_entrega_serial_excel: "Data em serial do Excel",
  data_solicitacao_serial_excel: "Data em serial do Excel",
  concluida_sem_data_entrega: "Concluída sem data de entrega",
  aprovacao_sem_status_final: "Aprovação sem status final",
  cliente_grafia_variante: "Grafia variante do cliente",
  revisoes_outlier: "Número de revisões implausível",
  revisoes_negativo: "Revisões negativas",
  revisoes_texto_nao_numerico: "Revisões em texto",
  revisoes_vazio: "Revisões em branco",
  revisoes_texto_convertido: "Revisões convertidas de texto",
  tipo_inferido: "Tipo inferido pelo título",
  entrega_antes_solicitacao: "Entrega antes da solicitação",
};

export default async function Revisao({ searchParams }: { searchParams: Promise<Busca> }) {
  const params = await searchParams;
  const codigo = params.codigo ?? "";
  const severidade = params.severidade ?? "";
  const status = params.status ?? "pendentes";
  const supabase = await criarClienteSupabaseServidor();

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

  const { data: contagem } = await supabase
    .from("erros_importacao")
    .select("codigo");

  const porCodigo = new Map<string, number>();
  for (const linha of contagem ?? []) {
    const c = String(linha.codigo);
    porCodigo.set(c, (porCodigo.get(c) ?? 0) + 1);
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
        Problemas encontrados na importação dos dados. Nada foi apagado: cada
        linha original está preservada na entrega. Marque como resolvido quando
        conferir.
      </p>

      <div className="stats">
        {Object.entries(
          (erros ?? []).reduce<Record<string, number>>((acc, e) => {
            acc[e.severidade] = (acc[e.severidade] ?? 0) + 1;
            return acc;
          }, {}),
        ).map(([sev, n]) => (
          <div key={sev} className={`stat ${sev === "critico" ? "alert" : ""}`}>
            <span className="value">{n}</span>
            <span className="label">
              {sev === "critico" ? "críticos (página atual)" : "avisos (página atual)"}
            </span>
          </div>
        ))}
      </div>

      <form className="filtros" method="get">
        <select name="codigo" defaultValue={codigo}>
          <option value="">Todos os tipos</option>
          {[...porCodigo.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c, n]) => (
              <option key={c} value={c}>
                {CODIGOS[c] ?? c} ({n})
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
        {count ?? 0} registro{(count ?? 0) === 1 ? "" : "s"}
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
            {(erros ?? []).map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`badge tom-${e.severidade === "critico" ? "erro" : "alerta"}`}>
                    {e.severidade === "critico" ? "Crítico" : "Aviso"}
                  </span>
                </td>
                <td>{CODIGOS[e.codigo] ?? e.codigo}</td>
                <td>
                  {e.entrega_id ? (
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
                  <BotaoResolver id={e.id} resolvido={e.resolvido} />
                </td>
              </tr>
            ))}
            {(erros ?? []).length === 0 && (
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