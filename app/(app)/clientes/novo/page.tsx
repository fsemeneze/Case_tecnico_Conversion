import Link from "next/link";
import { criarCliente } from "../actions";
import { FormularioCliente } from "../formulario";

type Busca = { erro?: string };

export default async function NovoCliente({ searchParams }: { searchParams: Promise<Busca> }) {
  const { erro } = await searchParams;

  return (
    <>
      <header className="topo">
        <div>
          <h1>Novo cliente</h1>
        </div>
        <div className="topo-acoes">
          <Link href="/clientes" className="botao secundario">
            Voltar
          </Link>
        </div>
      </header>

      {erro && <p className="erro">{erro}</p>}

      <FormularioCliente acao={criarCliente} botao="Criar cliente" />
    </>
  );
}