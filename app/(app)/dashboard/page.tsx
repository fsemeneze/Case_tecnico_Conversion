import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { contarIndicadores } from "@/lib/consultas";
import { notificarVencidas } from "./actions";

// Dashboard: visão executiva do projeto. Tudo server-rendered, sem JS no cliente.
// Os agregados vêm da função dashboard_resumo() (calcula no banco, sem o teto
// de 1000 linhas do PostgREST); a série mensal vem de indicadores_mensais.

type Resumo = {
  total: number;
  comparaveis: number;
  atrasadas: number;
  por_tipo: { tipo: string; total: number; atrasadas: number }[];
  por_fase: { fase: string; rotulo: string; total: number }[];
  top_clientes: { cliente: string; atrasadas: number }[];
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

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{
    notificacoes?: string;
    falhas?: string;
    sem_email?: string;
    erro_email?: string;
    email_liberado?: string;
    erro?: string;
  }>;
}) {
  const { notificacoes, falhas, sem_email, erro_email, email_liberado, erro } =
    await searchParams;
  const supabase = await criarClienteSupabaseServidor();

  const [{ data: resumo, error: erroResumo }, indicadores, { data: meses }] = await Promise.all([
    supabase.rpc("dashboard_resumo"),
    contarIndicadores(supabase),
    supabase
      .from("indicadores_mensais")
      .select("ano, mes, total_entregas, atrasadas_concluidas, vencidas_abertas")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),
  ]);

  const r = (resumo ?? {
    total: 0,
    comparaveis: 0,
    atrasadas: 0,
    por_tipo: [],
    por_fase: [],
    top_clientes: [],
  }) as Resumo;

  const taxaAtraso = pct(r.atrasadas, r.comparaveis);
  const porTipo = r.por_tipo.map((t) => ({ ...t, taxa: pct(t.atrasadas, t.total) }));

  // Série mensal (últimos 6 meses)
  const mapaMes = new Map<string, { ano: number; mes: number; total: number }>();
  for (const m of (meses ?? []) as LinhaMes[]) {
    const chave = `${m.ano}-${String(m.mes).padStart(2, "0")}`;
    const atual = mapaMes.get(chave) ?? { ano: m.ano, mes: m.mes, total: 0 };
    atual.total += Number(m.total_entregas) || 0;
    mapaMes.set(chave, atual);
  }
  const serie = [...mapaMes.values()]
    .sort((a, b) => a.ano * 100 + a.mes - (b.ano * 100 + b.mes))
    .slice(-6);
  const maxMes = Math.max(1, ...serie.map((s) => s.total));

  const cartoes = [
    { rotulo: "Entregas", valor: numero(r.total), href: "/entregas", tom: "neutro" },
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
        <div className="topo-acoes">
          <form action={notificarVencidas}>
            <button type="submit" className="botao secundario">
              Notificar clientes com prazo vencido
            </button>
          </form>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {notificacoes !== undefined && (
        <p className={Number(notificacoes) > 0 ? "aviso" : "muted"}>
          {Number(notificacoes)} e-mail(s) de prazo vencido enviado(s).
          {sem_email ? ` ${Number(sem_email)} cliente(s) sem e-mail cadastrado.` : ""}
        </p>
      )}
      {falhas !== undefined && (
        <p className="erro">
          {Number(falhas)} envio(s) não saíram
          {email_liberado
            ? `: o provedor está em modo de teste e só entrega para ${email_liberado}.`
            : erro_email
              ? `: ${erro_email}`
              : "."}
          {email_liberado
            ? " Verificar um domínio no Resend libera o envio a qualquer destinatário."
            : ""}
        </p>
      )}

      {erroResumo && <p className="erro">Não foi possível carregar os dados: {erroResumo.message}</p>}

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
          <p className="muted">Taxa = atrasadas sobre o total de cada tipo.</p>
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
                      title={`${s.total} entregas`}
                    />
                  </div>
                  <span className="barra-mes-rotulo">
                    {String(s.mes).padStart(2, "0")}/{s.ano}
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="muted">Altura = total de entregas no mês.</p>
        </section>

        <section className="cartao">
          <h2>Distribuição por fase</h2>
          {r.por_fase.map((f) => (
            <div key={f.fase} className="barra-linha">
              <span className="barra-rotulo">{f.rotulo}</span>
              <div className="barra-trilho">
                <div className="barra-fill fase" style={{ width: `${pct(f.total, r.total)}%` }} />
              </div>
              <span className="barra-valor">{f.total}</span>
            </div>
          ))}
        </section>

        <section className="cartao">
          <h2>Clientes com mais atraso</h2>
          {r.top_clientes.length === 0 && <p className="muted">Nenhum atraso registrado.</p>}
          <ul className="lista-chave">
            {r.top_clientes.map((c) => (
              <li key={c.cliente}>
                <span>{c.cliente}</span>
                <strong>{c.atrasadas}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}