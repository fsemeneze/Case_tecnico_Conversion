import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";

type Busca = { q?: string };

export default async function Clientes({ searchParams }: { searchParams: Promise<Busca> }) {
  const { q } = await searchParams;
  const busca = q?.trim() ?? "";
  const supabase = await criarClienteSupabaseServidor();

  let consulta = supabase
    .from("clientes")
    .select("id, nome, aliases_cliente(grafia)", { count: "exact" });

  if (busca) consulta = consulta.ilike("nome", `%${busca}%`);

  const { data: clientes, count } = await consulta.order("nome");

  // Contagem de entregas por cliente, para dar contexto na lista.
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
          <p className="eyebrow">PlanOps</p>
          <h1>Clientes</h1>
        </div>
      </header>

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
        {busca ? " com o filtro aplicado" : ""} · nomes canônicos, com as grafias
        da planilha na linha de baixo.
      </p>

      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Grafias da planilha</th>
              <th>Entregas</th>
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
                    <strong>{c.nome}</strong>
                  </td>
                  <td className="muted">
                    {aliases.length > 0 ? aliases.join(", ") : "—"}
                  </td>
                  <td>{porCliente.get(c.id) ?? 0}</td>
                </tr>
              );
            })}
            {(clientes ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
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