import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { BotaoCopiar } from "@/app/botao-copiar";
import { gerarAcessoCliente } from "./actions";

type Busca = { q?: string; link_cliente?: string; erro?: string };

export default async function Clientes({ searchParams }: { searchParams: Promise<Busca> }) {
  const { q, link_cliente, erro } = await searchParams;
  const busca = q?.trim() ?? "";
  const supabase = await criarClienteSupabaseServidor();

  let consulta = supabase
    .from("clientes")
    .select(
      "id, nome, nome_fantasia, cnpj, email, telefone, cidade, uf, ativo, aliases_cliente(grafia)",
      { count: "exact" },
    );

  if (busca) consulta = consulta.ilike("nome", `%${busca}%`);

  const { data: clientes, count } = await consulta.order("nome");

  // Contagem de entregas por cliente.
  const { data: contagens } = await supabase
    .from("entregas_detalhadas")
    .select("cliente_id");

  const porCliente = new Map<number, number>();
  for (const linha of contagens ?? []) {
    const id = Number(linha.cliente_id);
    porCliente.set(id, (porCliente.get(id) ?? 0) + 1);
  }

  return (
    <>
      <header className="topo">
        <div>
          <h1>Clientes</h1>
        </div>
        <div className="topo-acoes">
          <Link href="/clientes/novo" className="botao primario">
            Novo cliente
          </Link>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}
      {link_cliente && (
        <div className="aviso-box">
          <p>
            <strong>Link de acompanhamento gerado (válido por 90 dias):</strong>
          </p>
          <code>{`${await urlBase()}/cliente/${link_cliente}`}</code>
          <div className="aviso-acoes">
            <BotaoCopiar texto={`${await urlBase()}/cliente/${link_cliente}`} />
          </div>
          <p className="muted">Envie ao cliente. É somente leitura: mostra todas as entregas dele.</p>
        </div>
      )}

      <form className="filtros" method="get">
        <input type="search" name="q" placeholder="Buscar cliente…" defaultValue={busca} />
        <button type="submit">Filtrar</button>
        {busca && (
          <Link href="/clientes" className="botao secundario">
            Limpar
          </Link>
        )}
      </form>

      <p className="muted resumo">
        {count ?? 0} cliente{(count ?? 0) === 1 ? "" : "s"}
        {busca ? " com o filtro aplicado" : ""} · clique no nome para ver e editar.
      </p>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>CNPJ</th>
              <th>E-mail</th>
              <th>Telefone</th>
              <th>Cidade/UF</th>
              <th>Entregas</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(clientes ?? []).map((c) => {
              const aliases = (c.aliases_cliente ?? [])
                .map((a: { grafia: string }) => a.grafia)
                .filter((g: string) => g !== c.nome);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clientes/${c.id}`} className="titulo-link">
                      {c.nome}
                    </Link>
                    {c.nome_fantasia && c.nome_fantasia !== c.nome && (
                      <div className="muted">{c.nome_fantasia}</div>
                    )}
                    {aliases.length > 0 && <div className="muted">grafias: {aliases.join(", ")}</div>}
                  </td>
                  <td>{c.cnpj ?? "—"}</td>
                  <td>{c.email ?? "—"}</td>
                  <td>{c.telefone ?? "—"}</td>
                  <td>{[c.cidade, c.uf].filter(Boolean).join("/") || "—"}</td>
                  <td>{porCliente.get(c.id) ?? 0}</td>
                  <td>
                    <div className="acao-linha">
                      <Link href={`/clientes/${c.id}`} className="botao secundario">
                        Editar
                      </Link>
                      <form action={gerarAcessoCliente}>
                        <input type="hidden" name="cliente_id" value={c.id} />
                        <button type="submit" className="secundario">
                          Gerar link
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {(clientes ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function urlBase() {
  const { headers } = await import("next/headers");
  const cabecalhos = await headers();
  const host =
    cabecalhos.get("x-forwarded-host") ?? cabecalhos.get("host") ?? "localhost:3000";
  const protocolo = cabecalhos.get("x-forwarded-proto") ?? "http";
  return `${protocolo}://${host}`;
}