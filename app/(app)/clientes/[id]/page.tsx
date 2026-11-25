import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { atualizarCliente, gerarAcessoCliente } from "../actions";
import { FormularioCliente } from "../formulario";

type Busca = { erro?: string; ok?: string };

export default async function DetalheCliente({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Busca>;
}) {
  const { id } = await params;
  const { erro, ok } = await searchParams;
  const clienteId = Number(id);
  if (!Number.isInteger(clienteId)) notFound();

  const supabase = await criarClienteSupabaseServidor();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) notFound();

  const { count: totalEntregas } = await supabase
    .from("entregas_detalhadas")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteId);

  const { data: entregas } = await supabase
    .from("entregas_detalhadas")
    .select("id, titulo, fase_rotulo, data_prevista")
    .eq("cliente_id", clienteId)
    .order("data_prevista", { ascending: true, nullsFirst: false })
    .limit(10);

  return (
    <>
      <header className="topo">
        <div>
          <h1>{cliente.nome}</h1>
          <p className="muted">
            {cliente.nome_fantasia && cliente.nome_fantasia !== cliente.nome
              ? `${cliente.nome_fantasia} · `
              : ""}
            {totalEntregas ?? 0} entrega(s)
          </p>
        </div>
        <div className="topo-acoes">
          <Link href="/clientes" className="botao secundario">
            Voltar
          </Link>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="aviso">{ok}</p>}

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Dados do cliente</h2>
          <ul className="lista-chave">
            <li><span>Nome fantasia</span><strong>{cliente.nome_fantasia ?? "—"}</strong></li>
            <li><span>CNPJ</span><strong>{cliente.cnpj ?? "—"}</strong></li>
            <li><span>E-mail</span><strong>{cliente.email ?? "—"}</strong></li>
            <li><span>Telefone</span><strong>{cliente.telefone ?? "—"}</strong></li>
            <li><span>Cidade/UF</span><strong>{[cliente.cidade, cliente.uf].filter(Boolean).join("/") || "—"}</strong></li>
            <li><span>Contato</span><strong>{cliente.contato_nome ?? "—"}</strong></li>
            <li><span>Situação</span><strong>{cliente.ativo ? "Ativo" : "Inativo"}</strong></li>
          </ul>
          {cliente.observacoes && <p className="muted">{cliente.observacoes}</p>}
        </div>

        <div className="cartao">
          <h2>Acompanhamento</h2>
          <p className="muted">
            Gera um link somente leitura (90 dias) com todas as entregas deste cliente.
          </p>
          <form action={gerarAcessoCliente}>
            <input type="hidden" name="cliente_id" value={cliente.id} />
            <button type="submit" className="secundario">
              Gerar link de acompanhamento
            </button>
          </form>
        </div>
      </section>

      <section className="grade-detalhe">
        <div className="cartao">
          <h2>Entregas recentes</h2>
          {entregas && entregas.length > 0 ? (
            <ul className="linha-tempo">
              {entregas.map((e) => (
                <li key={e.id}>
                  <Link href={`/entregas/${e.id}`}>{e.titulo}</Link>{" "}
                  <span className="muted">
                    {e.fase_rotulo} · {e.data_prevista ?? "sem prazo"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma entrega.</p>
          )}
        </div>
      </section>

      <h2>Editar cliente</h2>
      <FormularioCliente acao={atualizarCliente} cliente={cliente} botao="Salvar alterações" />
    </>
  );
}