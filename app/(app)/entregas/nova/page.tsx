import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { listarClientes } from "@/lib/consultas";
import { Icone } from "@/app/icones";
import { FormularioNovaEntrega } from "./formulario";

const TIPOS = ["Relatório", "Análise", "Conteúdo"];

export default async function NovaEntrega() {
  const supabase = await criarClienteSupabaseServidor();
  const [clientes, squads, pessoas] = await Promise.all([
    listarClientes(supabase),
    supabase.from("squads").select("nome").order("nome"),
    supabase.from("pessoas").select("nome").order("nome"),
  ]);

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
        pessoas={(pessoas.data ?? []).map((p) => p.nome)}
      />
    </>
  );
}