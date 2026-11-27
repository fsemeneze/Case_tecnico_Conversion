import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";
import { ROTULO_APROVACAO, situacaoDaEntrega } from "@/lib/fases";
import { rotuloEvento, rotuloCampo, rotuloCodigo } from "@/lib/eventos";
import { buscarEntrega, listarEventos, listarAprovacoes } from "@/lib/consultas";
import { Icone } from "@/app/icones";
import { BotaoCopiar } from "@/app/botao-copiar";
import { gerarLinkAprovacao } from "../actions";
import { AlterarSituacao } from "./alterar-situacao";

type Params = { id: string };

type Busca = {
  erro?: string;
  token_criado?: string;
  email?: string;
  email_destino?: string;
  email_erro?: string;
  email_teste?: string;
  email_liberado?: string;
};

export default async function DetalheEntrega({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Busca>;
}) {
  const { id } = await params;
  const {
    erro,
    token_criado,
    email,
    email_destino,
    email_erro,
    email_teste,
    email_liberado,
  } = await searchParams;
  const entregaId = Number(id);
  if (!Number.isInteger(entregaId)) notFound();

  const hoje = new Date().toISOString().slice(0, 10);
  const supabase = await criarClienteSupabaseServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: perfil } = await supabase
    .from("usuario")
    .select("papel")
    .eq("id", user?.id ?? "")
    .maybeSingle();
  const podeEditar = perfil?.papel === "admin" || perfil?.papel === "gestor";
  const { data: fases } = await supabase
    .from("fases")
    .select("id, codigo, rotulo")
    .order("ordem");

  const [entrega, aprovacoes, historico] = await Promise.all([
    buscarEntrega(supabase, entregaId),
    listarAprovacoes(supabase, entregaId),
    listarEventos(supabase, entregaId),
  ]);

  if (!entrega) notFound();

  const admin = criarClienteSupabaseAdmin();
  const [{ data: linksAtivos }, { data: emails }] = await Promise.all([
    admin.rpc("links_aprovacao_ativos", { p_entrega_id: entregaId }),
    admin
      .from("notificacoes")
      .select("id, tipo, destino, status, erro")
      .eq("entidade_id", entregaId)
      .order("criado_em", { ascending: false })
      .limit(5),
  ]);
  const tokensAtivos = Number((linksAtivos as { ativos: number } | null)?.ativos ?? 0);
  const emailsEntrega = emails ?? [];
  const erroEmail = emailsEntrega.find((n) => n.status === "erro")?.erro as
    | string
    | undefined;
  const linkAprovacao = token_criado
    ? `${await urlBase()}/aprovacao/${token_criado}`
    : null;

  const situ = situacaoDaEntrega(
    {
      fase: entrega.fase,
      data_prevista: entrega.data_prevista,
      dias_atraso: entrega.dias_atraso,
    },
    hoje,
  );

  // Botões "Gerar link" só para etapas sem decisão conclusiva. Planejamento
  // "não se aplica" (D6) nunca tem link; etapa aprovada não é reaprovada.
  const planejamentoAberto = ["pendente", "nao_informado"].includes(
    entrega.aprovacao_planejamento,
  );
  const entregaAberta = ["pendente", "nao_informado"].includes(
    entrega.aprovacao_entrega,
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
        <div className="topo-acoes">
          {podeEditar && (
            <Link href={`/entregas/${entrega.id}/editar`} className="botao primario">
              Editar
            </Link>
          )}
          <Link href="/entregas" className="botao secundario">
            <Icone nome="voltar" width={17} height={17} />
            Voltar
          </Link>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {linkAprovacao && (
        <div className="aviso-box">
          <p>
            <strong>Link de aprovação gerado (válido por 7 dias):</strong>
          </p>
          <code>{linkAprovacao}</code>
          <div className="aviso-acoes">
            <BotaoCopiar texto={linkAprovacao} />
            <a
              className="botao secundario"
              href={linkAprovacao}
              target="_blank"
              rel="noreferrer"
            >
              <Icone nome="externo" width={16} height={16} />
              Abrir
            </a>
          </div>
          {email === "enviado" && (
            <p className="aviso">E-mail com o link enviado para {email_destino}.</p>
          )}
          {email === "sem_email" && (
            <p className="muted">
              Este cliente não tem e-mail cadastrado. Copie o link e envie pelo canal
              de contato.
            </p>
          )}
          {email === "falhou" && email_teste === "1" && (
            <>
              <p className="erro">
                O e-mail para {email_destino} não saiu: o provedor está em modo de
                teste{email_liberado ? ` e só entrega para ${email_liberado}` : ""}.
                Verificar um domínio no Resend libera o envio a qualquer destinatário.
              </p>
              <p className="muted">
                O link acima está válido — copie e envie ao cliente pelo canal de
                contato.
              </p>
            </>
          )}
          {email === "falhou" && email_teste !== "1" && (
            <>
              <p className="erro">
                O e-mail para {email_destino} não saiu: {email_erro ?? "erro no provedor"}.
              </p>
              <p className="muted">
                O link acima continua válido — copie e envie manualmente.
              </p>
            </>
          )}
        </div>
      )}

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Situação</h2>
          <p>
            <span className={`badge tom-${situ.tom}`}>{situ.rotulo}</span>{" "}
            <span className="badge tom-info">{entrega.fase_rotulo}</span>
          </p>
          {!podeEditar && (
            <AlterarSituacao
              entregaId={entrega.id}
              faseAtualId={entrega.fase_id}
              fases={fases ?? []}
            />
          )}
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
              <span>Atraso</span>
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
              {planejamentoAberto && (
                <form action={gerarLinkAprovacao}>
                  <input type="hidden" name="entrega_id" value={entrega.id} />
                  <input type="hidden" name="etapa" value="planejamento" />
                  <button type="submit" className="botao primario">
                    Gerar link de planejamento
                  </button>
                </form>
              )}
            </div>
            <div>
              <strong>2 · Entrega</strong>
              <p>
                <span className={`badge tom-${tomAprovacao(entrega.aprovacao_entrega)}`}>
                  {ROTULO_APROVACAO[entrega.aprovacao_entrega]}
                </span>
              </p>
              {entregaAberta && (
                <form action={gerarLinkAprovacao}>
                  <input type="hidden" name="entrega_id" value={entrega.id} />
                  <input type="hidden" name="etapa" value="entrega" />
                  <button type="submit" className="botao primario">
                    Gerar link de entrega
                  </button>
                </form>
              )}
            </div>
          </div>

          {tokensAtivos > 0 && (
            <p className="muted">{tokensAtivos} link(s) ativo(s) para esta entrega.</p>
          )}

          {emailsEntrega.length > 0 && (
            <div className="emails-entrega">
              <p className="muted">
                <strong>E-mails desta entrega</strong>
              </p>
              <ul className="lista-chave">
                {emailsEntrega.map((n) => (
                  <li key={n.id}>
                    <span>
                      {rotuloEmail(n.tipo)} → {n.destino}
                    </span>
                    <strong
                      className={`badge tom-${n.status === "enviado" ? "ok" : "erro"}`}
                    >
                      {n.status === "enviado" ? "enviado" : "falhou"}
                    </strong>
                  </li>
                ))}
              </ul>
              {erroEmail && (
                <p className="muted">Último erro: {erroEmail.slice(0, 200)}</p>
              )}
            </div>
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

const ROTULO_EMAIL: Record<string, string> = {
  link_aprovacao: "Link de aprovação",
  decisao_cliente: "Decisão do cliente",
  prazo_vencido: "Prazo vencido",
  teste: "Teste",
};

function rotuloEmail(tipo: string): string {
  return ROTULO_EMAIL[tipo] ?? tipo;
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