import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { listarClientes } from "@/lib/consultas";
import { FormularioNovaEntrega } from "./formulario";

const TIPOS = ["Relatório", "Análise", "Conteúdo"];

export default async function NovaEntrega() {
  const supabase = await criarClienteSupabaseServidor();
  const clientes = await listarClientes(supabase);

  return (
    <>
      <header className="topo">
        <div>
          <p className="eyebrow">PlanOps</p>
          <h1>Nova entrega</h1>
        </div>
        <Link href="/entregas" className="botao secundario">
          ← Voltar
        </Link>
      </header>

      <FormularioNovaEntrega clientes={clientes} tipos={TIPOS} />
    </>
  );
}