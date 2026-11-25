import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { ROTULO_APROVACAO, situacaoDaEntrega } from "@/lib/fases";
import { rotuloEvento, rotuloCampo, rotuloCodigo } from "@/lib/eventos";
import { buscarEntrega, listarEventos, listarAprovacoes } from "@/lib/consultas";
import { Icone } from "@/app/icones";
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

  const [entrega, aprovacoes, historico] = await Promise.all([
    buscarEntrega(supabase, entregaId),
    listarAprovacoes(supabase, entregaId),
    listarEventos(supabase, entregaId),
  ]);

  if (!entrega) notFound();

  const admin = criarClienteSupabaseAdmin();
  const { data: linksAtivos } = await admin.rpc("links_aprovacao_ativos", {
    p_entrega_id: entregaId,
  });
  const tokensAtivos = Number((linksAtivos as { ativos: number } | null)?.ativos ?? 0);

  const situ = situacaoDaEntrega(
    {
      fase: entrega.fase,
      data_prevista: entrega.data_prevista,
      dias_atraso: entrega.dias_atraso,
    },
    hoje,
  );

  return (
    <>
      <header className="topo">
        <div>
          <h1>{entrega.titulo}</h1>
          <p className="muted">
            {[
              `#${entrega.id}`,
              entrega.legacy_id ? `registro nº ${entrega.legacy_id}` : "",
              entrega.cliente,
              entrega.tipo,
              entrega.subtipo,
              entrega.squad,
              entrega.responsavel,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link href="/entregas" className="botao secundario">
          <Icone nome="voltar" width={17} height={17} />
          Voltar
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
            <span className="badge tom-info">{entrega.fase_rotulo}</span>
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
                {entrega.dias_atraso === null ? "—" : `${entrega.dias_atraso} dia(s)`}
              </strong>
            </li>
            <li>
              <span>Ciclo</span>
              <strong>
                {entrega.dias_ciclo === null ? "—" : `${entrega.dias_ciclo} dia(s)`}
              </strong>
            </li>
            <li>
              <span>Revisões</span>
              <strong>{entrega.num_revisoes ?? "—"}</strong>
            </li>
            <li>
              <span>Origem</span>
              <strong>{entrega.origem}</strong>
            </li>
          </ul>
          {entrega.link && (
            <p>
              <a href={entrega.link} target="_blank" rel="noreferrer">
                Abrir arquivo <Icone nome="externo" width={15} height={15} />
              </a>
            </p>
          )}
          {entrega.observacoes && <p className="muted">{entrega.observacoes}</p>}
          {(entrega.flags ?? []).length > 0 && (
            <p className="muted">
              Sinalizações de qualidade: {(entrega.flags ?? [])
                .map((f) => rotuloCodigo(f))
                .join(", ")}
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
            <p className="muted">{tokensAtivos} link(s) ativo(s) para esta entrega.</p>
          )}
        </div>
      </section>

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Histórico de mudanças</h2>
          {historico.length === 0 && (
            <p className="muted">Nenhuma mudança registrada.</p>
          )}
          <ul className="linha-tempo">
            {historico.map((h) => (
              <li key={h.id}>
                <strong>{rotuloEvento(h.tipo_evento)}</strong>
                {rotuloCampo(h.campo) ? ` · ${rotuloCampo(h.campo)}` : ""}: {h.valor_antigo ?? "(vazio)"} →{" "}
                {h.valor_novo ?? "(vazio)"}{" "}
                <span className="muted">
                  {new Date(h.criado_em).toLocaleString("pt-BR")} · {h.autor ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cartao">
          <h2>Aprovações registradas</h2>
          {aprovacoes.length === 0 && (
            <p className="muted">
              Nenhuma ainda. Envie o link ao cliente quando o trabalho estiver
              pronto para revisão.
            </p>
          )}
          <ul className="linha-tempo">
            {aprovacoes.map((a) => (
              <li key={a.id}>
                <strong>{a.etapa}</strong>: {ROTULO_APROVACAO[a.decisao]} por{" "}
                {a.autor_nome}
                {a.autor_email ? ` (${a.autor_email})` : ""}
                {a.observacao ? ` — “${a.observacao}”` : ""}{" "}
                <span className="muted">
                  {new Date(a.criado_em).toLocaleString("pt-BR")}
                  {a.autor_ip ? ` · IP ${a.autor_ip}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
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
  const host =
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${host}`;
}