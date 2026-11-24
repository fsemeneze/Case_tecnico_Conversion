import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { ROTULO_FASE, ROTULO_APROVACAO, FASES_ABERTAS, situacaoDaEntrega } from "@/lib/fases";
import { gerarLinkAprovacao } from "../actions";

type Params = { id: string };

export default async function DetalheEntrega({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ erro?: string; token_criado?: string }>;
}) {
  const { id } = await params;
  const { erro, token_criado } = await searchParams;
  const entregaId = Number(id);
  if (!Number.isInteger(entregaId)) notFound();

  const hoje = new Date().toISOString().slice(0, 10);
  const supabase = await criarClienteSupabaseServidor();

  const [{ data: entrega }, { data: aprovacoes }, { data: historico }] =
    await Promise.all([
      supabase
        .from("entregas")
        .select("*, clientes ( nome )")
        .eq("id", entregaId)
        .single(),
      supabase
        .from("aprovacoes")
        .select("*")
        .eq("entrega_id", entregaId)
        .order("criado_em", { ascending: false }),
      supabase
        .from("entrega_historico")
        .select("*")
        .eq("entrega_id", entregaId)
        .order("criado_em", { ascending: false })
        .limit(50),
    ]);

  if (!entrega) notFound();

  // Tokens são privados (sem política de RLS): a rota de servidor consulta
  // via função SECURITY DEFINER com service_role.
  const admin = criarClienteSupabaseAdmin();
  const { data: linksAtivos } = await admin.rpc("links_aprovacao_ativos", {
    p_entrega_id: entregaId,
  });

  const situ = situacaoDaEntrega(
    {
      fase: entrega.fase,
      data_prevista: entrega.data_prevista,
      dias_atraso: entrega.dias_atraso,
    },
    hoje,
  );

  const tokensAtivos = Number((linksAtivos as { ativos: number } | null)?.ativos ?? 0);

  return (
    <main className="app">
      <header className="topo">
        <div>
          <p className="eyebrow">
            Entrega #{entrega.id}
            {entrega.legacy_id ? ` · planilha nº ${entrega.legacy_id}` : ""}
          </p>
          <h1>{entrega.titulo}</h1>
          <p className="muted">
            {entrega.clientes?.nome} · {entrega.tipo}
            {entrega.subtipo ? ` · ${entrega.subtipo}` : ""}
            {entrega.squad ? ` · ${entrega.squad}` : ""}
            {entrega.responsavel ? ` · ${entrega.responsavel}` : ""}
          </p>
        </div>
        <Link href="/entregas" className="botao secundario">
          ← Voltar
        </Link>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {token_criado && (
        <div className="aviso-box">
          <p>
            <strong>Link de aprovação gerado (válido por 7 dias):</strong>
          </p>
          <code>{`${await urlBase()}/aprovacao/${token_criado}`}</code>
          <p className="muted">Envie ao cliente pelo canal de contato.</p>
        </div>
      )}

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Situação</h2>
          <p>
            <span className={`badge tom-${situ.tom}`}>{situ.rotulo}</span>{" "}
            <span className="badge tom-info">
              {ROTULO_FASE[entrega.fase] ?? entrega.fase}
            </span>
          </p>
          <ul className="lista-chave">
            <li>
              <span>Prazo</span>
              <strong>{entrega.data_prevista ?? "—"}</strong>
            </li>
            <li>
              <span>Entrega</span>
              <strong>{entrega.data_entrega ?? "—"}</strong>
            </li>
            <li>
              <span>Atraso (D8)</span>
              <strong>
                {entrega.dias_atraso === null
                  ? "—"
                  : `${entrega.dias_atraso} dia(s)`}
              </strong>
            </li>
            <li>
              <span>Revisões</span>
              <strong>{entrega.num_revisoes ?? "—"}</strong>
            </li>
          </ul>
          {entrega.link && (
            <p>
              <a href={entrega.link} target="_blank" rel="noreferrer">
                Abrir arquivo ↗
              </a>
            </p>
          )}
          {entrega.observacoes && (
            <p className="muted">{entrega.observacoes}</p>
          )}
          {(entrega.flags ?? []).length > 0 && (
            <p className="muted">
              Sinalizações da importação: {(entrega.flags ?? []).join(", ")}
            </p>
          )}
        </div>

        <div className="cartao">
          <h2>Aprovação em 2 etapas</h2>
          <p className="muted">
            O cliente não tem login: recebe um link de uso único por etapa.
          </p>

          <div className="etapas-aprovacao">
            <div>
              <strong>1 · Planejamento</strong>
              <p>
                <span className={`badge tom-${tomAprovacao(entrega.aprovacao_planejamento)}`}>
                  {ROTULO_APROVACAO[entrega.aprovacao_planejamento]}
                </span>
              </p>
              <form action={gerarLinkAprovacao}>
                <input type="hidden" name="entrega_id" value={entrega.id} />
                <input type="hidden" name="etapa" value="planejamento" />
                <button type="submit" className="secundario">
                  Gerar link de planejamento
                </button>
              </form>
            </div>
            <div>
              <strong>2 · Entrega</strong>
              <p>
                <span className={`badge tom-${tomAprovacao(entrega.aprovacao_entrega)}`}>
                  {ROTULO_APROVACAO[entrega.aprovacao_entrega]}
                </span>
              </p>
              <form action={gerarLinkAprovacao}>
                <input type="hidden" name="entrega_id" value={entrega.id} />
                <input type="hidden" name="etapa" value="entrega" />
                <button type="submit" className="secundario">
                  Gerar link de entrega
                </button>
              </form>
            </div>
          </div>

          {tokensAtivos > 0 && (
            <p className="muted">
              {tokensAtivos} link(s) ativo(s) para esta entrega.
            </p>
          )}
        </div>
      </section>

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Histórico de mudanças</h2>
          {(historico ?? []).length === 0 && (
            <p className="muted">Nenhuma mudança desde a importação.</p>
          )}
          <ul className="linha-tempo">
            {(historico ?? []).map((h) => (
              <li key={h.id}>
                <strong>{h.campo}</strong>: {h.valor_antigo ?? "(vazio)"} →{" "}
                {h.valor_novo ?? "(vazio)"}{" "}
                <span className="muted">
                  {new Date(h.criado_em).toLocaleString("pt-BR")} ·{" "}
                  {h.autor ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cartao">
          <h2>Aprovações registradas</h2>
          {(aprovacoes ?? []).length === 0 && (
            <p className="muted">
              Nenhuma ainda. Envie o link ao cliente quando o trabalho estiver
              pronto para revisão.
            </p>
          )}
          <ul className="linha-tempo">
            {(aprovacoes ?? []).map((a) => (
              <li key={a.id}>
                <strong>{a.etapa}</strong>: {ROTULO_APROVACAO[a.decisao]} por{" "}
                {a.autor_nome}
                {a.observacao ? ` — “${a.observacao}”` : ""}{" "}
                <span className="muted">
                  {new Date(a.criado_em).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {FASES_ABERTAS.includes(entrega.fase as never) && (
        <p className="muted">
          Entrega em aberto: aparece na lista de “vencidas” quando o prazo
          passa sem conclusão.
        </p>
      )}
    </main>
  );
}

function tomAprovacao(decisao: string): string {
  if (decisao === "aprovada") return "ok";
  if (decisao === "aprovada_com_ressalvas") return "alerta";
  if (decisao === "recusada") return "erro";
  return "neutro";
}

async function urlBase() {
  const { headers } = await import("next/headers");
  const cabecalhos = await headers();
  const host = cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${host}`;
}
