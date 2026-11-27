import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { buscarEntrega } from "@/lib/consultas";
import { FormularioEdicao } from "./formulario-edicao";

export default async function EditarEntrega({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entregaId = Number(id);
  if (!Number.isInteger(entregaId) || entregaId <= 0) notFound();

  const supabase = await criarClienteSupabaseServidor();
  const entrega = await buscarEntrega(supabase, entregaId);
  if (!entrega) notFound();

  const [squads, pessoas, vinculos] = await Promise.all([
    supabase.from("squads").select("id, nome").order("nome"),
    supabase.from("pessoas").select("id, nome").order("nome"),
    supabase
      .from("entregas")
      .select("pessoa_id, squad_id")
      .not("pessoa_id", "is", null),
  ]);

  const contagem = new Map<number, Map<number, number>>();
  for (const v of vinculos.data ?? []) {
    if (!v.squad_id || !v.pessoa_id) continue;
    const m = contagem.get(v.pessoa_id) ?? new Map<number, number>();
    m.set(v.squad_id, (m.get(v.squad_id) ?? 0) + 1);
    contagem.set(v.pessoa_id, m);
  }
  const nomeDoSquad = new Map((squads.data ?? []).map((s) => [s.id, s.nome]));
  const pessoasComSquad = (pessoas.data ?? []).map((p) => {
    const m = contagem.get(p.id);
    let squad: string | null = null;
    if (m) {
      const maisFrequente = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
      squad = nomeDoSquad.get(maisFrequente) ?? null;
    }
    return { nome: p.nome, squad };
  });

  return (
    <>
      <header className="topo">
        <div>
          <h1>Editar entrega</h1>
          <p className="muted">
            #{entrega.id} · {entrega.cliente} · {entrega.fase_rotulo}
          </p>
        </div>
        <Link href={`/entregas/${entrega.id}`} className="botao secundario">
          Voltar
        </Link>
      </header>

      <FormularioEdicao
        entrega={entrega}
        squads={(squads.data ?? []).map((s) => s.nome)}
        pessoas={pessoasComSquad}
      />
    </>
  );
}