import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { listarClientes } from "@/lib/consultas";
import { Icone } from "@/app/icones";
import { FormularioNovaEntrega } from "./formulario";

const TIPOS = ["Relatório", "Análise", "Conteúdo"];

export default async function NovaEntrega() {
  const supabase = await criarClienteSupabaseServidor();
  const clientes = await listarClientes(supabase);

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

      <FormularioNovaEntrega clientes={clientes} tipos={TIPOS} />
    </>
  );
}