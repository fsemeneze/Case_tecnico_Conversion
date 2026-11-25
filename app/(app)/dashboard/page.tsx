import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { contarIndicadores } from "@/lib/consultas";

// Dashboard: visão executiva do projeto. Tudo server-rendered, sem JS no cliente.
// Reaproveita a view entregas_detalhadas e os indicadores mensais.

type LinhaEntrega = {
  tipo: string;
  fase: string;
  fase_rotulo: string;
  fase_grupo: "aberta" | "final" | "cancelada";
  cliente: string;
  data_prevista: string | null;
  data_entrega: string | null;
  dias_atraso: number | null;
};

type LinhaMes = {
  ano: number;
  mes: number;
  total_entregas: number;
  atrasadas_concluidas: number;
  vencidas_abertas: number;
};

const numero = (v: number) => v.toLocaleString("pt-BR");
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export default async function Dashboard() {
  const supabase = await criarClienteSupabaseServidor();
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: linhas, error: erroLinhas }, indicadores, { data: meses }] = await Promise.all([
    supabase
      .from("entregas_detalhadas")
      .select("tipo, fase, fase_rotulo, fase_grupo, cliente, data_prevista, data_entrega, dias_atraso"),
    contarIndicadores(supabase),
    supabase
      .from("indicadores_mensais")
      .select("ano, mes, total_entregas, atrasadas_concluidas, vencidas_abertas")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),
  ]);

  const entregas = (linhas ?? []) as LinhaEntrega[];
  const atrasada = (e: LinhaEntrega) =>
    (e.dias_atraso ?? 0) > 0 || (e.fase_grupo === "aberta" && e.data_prevista && e.data_prevista < hoje);
  const comparavel = (e: LinhaEntrega) =>
    Boolean(e.data_prevista) && (Boolean(e.data_entrega) || e.fase_grupo === "aberta");

  const total = entregas.length;
  const atrasadas = entregas.filter(atrasada).length;
  const comparaveis = entregas.filter(comparavel).length;
  const taxaAtraso = pct(atrasadas, comparaveis);

  // Atraso por tipo
  const tipos = ["Relatório", "Análise", "Conteúdo"];
  const porTipo = tipos.map((tipo) => {
    const doTipo = entregas.filter((e) => e.tipo === tipo);
    const atr = doTipo.filter(atrasada).length;
    return { tipo, total: doTipo.length, atrasadas: atr, taxa: pct(atr, doTipo.length) };
  });

  // Distribuição por fase
  const contagemFase = new Map<string, { rotulo: string; total: number }>();
  for (const e of entregas) {
    const atual = contagemFase.get(e.fase) ?? { rotulo: e.fase_rotulo, total: 0 };
    atual.total++;
    contagemFase.set(e.fase, atual);
  }
  const porFase = [...contagemFase.values()].sort((a, b) => b.total - a.total);

  // Clientes com mais atraso
  const atrasoPorCliente = new Map<string, number>();
  for (const e of entregas) if (atrasada(e)) atrasoPorCliente.set(e.cliente, (atrasoPorCliente.get(e.cliente) ?? 0) + 1);
  const topClientes = [...atrasoPorCliente.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Série mensal (últimos 6 meses)
  const mapaMes = new Map<string, { ano: number; mes: number; total: number; atrasadas: number }>();
  for (const m of (meses ?? []) as LinhaMes[]) {
    const chave = `${m.ano}-${String(m.mes).padStart(2, "0")}`;
    const atual = mapaMes.get(chave) ?? { ano: m.ano, mes: m.mes, total: 0, atrasadas: 0 };
    atual.total += Number(m.total_entregas) || 0;
    atual.atrasadas += (Number(m.atrasadas_concluidas) || 0) + (Number(m.vencidas_abertas) || 0);
    mapaMes.set(chave, atual);
  }
  const serie = [...mapaMes.values()].sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes)).slice(-6);
  const maxMes = Math.max(1, ...serie.map((s) => s.total));

  const cartoes = [
    { rotulo: "Entregas", valor: numero(total), href: "/entregas", tom: "neutro" },
    { rotulo: "Taxa de atraso", valor: `${taxaAtraso}%`, href: "/entregas?situacao=atrasadas", tom: "alerta" },
    { rotulo: "Em atraso", valor: numero(indicadores.atraso), href: "/entregas?situacao=atrasadas", tom: "alerta" },
    { rotulo: "Vencidas hoje", valor: numero(indicadores.vencidas), href: "/entregas?situacao=vencidas", tom: "alerta" },
    { rotulo: "Aguardando cliente", valor: numero(indicadores.aguardando), href: "/entregas?fase=aguardando_aprovacao_entrega", tom: "info" },
    { rotulo: "Fila de revisão", valor: numero(indicadores.revisao), href: "/revisao", tom: "neutro" },
  ];

  return (
    <>
      <header className="topo">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Visão do projeto · atualizado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
      </header>

      {erroLinhas && <p className="erro">Não foi possível carregar os dados: {erroLinhas.message}</p>}

      <div className="stats">
        {cartoes.map((c) => (
          <Link key={c.rotulo} href={c.href} className={`stat ${c.tom === "alerta" ? "alert" : ""}`}>
            <span className="value">{c.valor}</span>
            <span className="label">{c.rotulo}</span>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        <section className="cartao">
          <h2>Atraso por tipo</h2>
          {porTipo.map((t) => (
            <div key={t.tipo} className="barra-linha">
              <span className="barra-rotulo">{t.tipo}</span>
              <div className="barra-trilho">
                <div className="barra-fill" style={{ width: `${t.taxa}%` }} />
              </div>
              <span className="barra-valor">
                {t.atrasadas}/{t.total} · {t.taxa}%
              </span>
            </div>
          ))}
          <p className="muted">
            Taxa = atrasadas (D8) sobre o total de cada tipo.
          </p>
        </section>

        <section className="cartao">
          <h2>Entregas por mês</h2>
          {serie.length === 0 && <p className="muted">Sem dados mensais.</p>}
          {serie.length > 0 && (
            <div className="barra-meses">
              {serie.map((s) => (
                <div key={`${s.ano}-${s.mes}`} className="barra-mes">
                  <div className="barra-mes-col">
                    <div
                      className="barra-mes-fill"
                      style={{ height: `${Math.max(2, (s.total / maxMes) * 100)}%` }}
                      title={`${s.total} entregas · ${s.atrasadas} atrasadas`}
                    />
                  </div>
                  <span className="barra-mes-rotulo">
                    {String(s.mes).padStart(2, "0")}/{s.ano}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted">Altura = total de entregas no mês (passe o mouse para ver o atraso).</p>
        </section>

        <section className="cartao">
          <h2>Distribuição por fase</h2>
          {porFase.map((f) => (
            <div key={f.rotulo} className="barra-linha">
              <span className="barra-rotulo">{f.rotulo}</span>
              <div className="barra-trilho">
                <div className="barra-fill fase" style={{ width: `${pct(f.total, total)}%` }} />
              </div>
              <span className="barra-valor">{f.total}</span>
            </div>
          ))}
        </section>

        <section className="cartao">
          <h2>Clientes com mais atraso</h2>
          {topClientes.length === 0 && <p className="muted">Nenhum atraso registrado.</p>}
          <ul className="lista-chave">
            {topClientes.map(([cliente, qtd]) => (
              <li key={cliente}>
                <span>{cliente}</span>
                <strong>{qtd}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}