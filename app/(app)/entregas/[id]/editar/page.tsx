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

      <FormularioEdicao entrega={entrega} />
    </>
  );
}