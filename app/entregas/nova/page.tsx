import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { cadastrarEntrega } from "../actions";

const TIPOS = ["Relatório", "Análise", "Conteúdo"];

export default async function NovaEntrega({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await criarClienteSupabaseServidor();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nome")
    .order("nome");

  return (
    <main className="app">
      <header className="topo">
        <div>
          <p className="eyebrow">Controle de entregas</p>
          <h1>Nova entrega</h1>
        </div>
        <Link href="/entregas" className="botao secundario">
          ← Voltar
        </Link>
      </header>

      {erro && <p className="erro">{erro}</p>}

      <form action={cadastrarEntrega} className="cartao-form">
        <label>
          Título *
          <input
            name="titulo"
            required
            placeholder="Relatório mensal 12/2026"
          />
        </label>

        <label>
          Cliente *
          <select name="cliente_id" defaultValue="" required>
            <option value="" disabled>
              Selecione…
            </option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          Novo cliente (opcional — cria um registro novo)
          <input name="novo_cliente" placeholder="Nome canônico do cliente" />
        </label>

        <label>
          Tipo *
          <select name="tipo" defaultValue="Relatório" required>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label>
          Subtipo (opcional)
          <input name="subtipo" placeholder="Ex.: Core Web Vitals" />
        </label>

        <label>
          Data de solicitação
          <input type="date" name="data_solicitacao" />
        </label>

        <label>
          Data prevista
          <input type="date" name="data_prevista" />
        </label>

        <label>
          Squad
          <input name="squad" placeholder="Squad Azul" />
        </label>

        <label>
          Responsável
          <input name="responsavel" placeholder="Ana" />
        </label>

        <label>
          Link do arquivo (Drive)
          <input name="link" type="url" placeholder="https://drive.google.com/…" />
        </label>

        <label className="coluna">
          Observações
          <textarea name="observacoes" rows={3} />
        </label>

        <p className="muted">
          A entrega nasce na fase <strong>Solicitada</strong>. O link de
          aprovação do planejamento é gerado na tela da entrega.
        </p>

        <button type="submit">Cadastrar entrega</button>
      </form>
    </main>
  );
}
