import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { listarClientes } from "@/lib/consultas";
import { Icone } from "@/app/icones";
import { FormularioNovaEntrega } from "./formulario";

const TIPOS = ["Relatório", "Análise", "Conteúdo"];

export default async function NovaEntrega() {
  const supabase = await criarClienteSupabaseServidor();
  const [clientes, squads, pessoas, vinculos] = await Promise.all([
    listarClientes(supabase),
    supabase.from("squads").select("id, nome").order("nome"),
    supabase.from("pessoas").select("id, nome").order("nome"),
    supabase
      .from("entregas")
      .select("pessoa_id, squad_id")
      .not("pessoa_id", "is", null),
  ]);

  // Squad de cada pessoa: o mais frequente entre as entregas dela.
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
          <h1>Nova entrega</h1>
        </div>
        <Link href="/entregas" className="botao secundario">
          <Icone nome="voltar" width={17} height={17} />
          Voltar
        </Link>
      </header>

      <FormularioNovaEntrega
        clientes={clientes}
        tipos={TIPOS}
        squads={(squads.data ?? []).map((s) => s.nome)}
        pessoas={pessoasComSquad}
      />
    </>
  );
}