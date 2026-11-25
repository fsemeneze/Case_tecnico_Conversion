import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { contarIndicadores } from "@/lib/consultas";

const numero = (valor: number) => valor.toLocaleString("pt-BR");

export default async function Inicio() {
  const supabase = await criarClienteSupabaseServidor();

  // Indicadores e a lista de atenção são independentes: disparam juntos.
  const [indicadores, { data: attention }] = await Promise.all([
    contarIndicadores(supabase),
    supabase
      .from("entregas_detalhadas")
      .select("id, titulo, data_prevista, fase, cliente")
      .in("fase", ["ajuste_solicitado", "aguardando_cliente", "aguardando_aprovacao_entrega"])
      .order("data_prevista", { ascending: true, nullsFirst: false })
      .limit(8),
  ]);

  const cartoes = [
    { rotulo: "Entregas em atraso", valor: indicadores.atraso, href: "/entregas?situacao=atrasadas", tom: "alerta" },
    { rotulo: "Vencidas hoje", valor: indicadores.vencidas, href: "/entregas?situacao=vencidas", tom: "alerta" },
    { rotulo: "Aguardando cliente", valor: indicadores.aguardando, href: "/entregas?fase=aguardando_aprovacao_entrega", tom: "info" },
    { rotulo: "Na fila de revisão", valor: indicadores.revisao, href: "/revisao", tom: "neutro" },
  ];

  return (
    <>
      <header className="topo">
        <div>
          <h1>Início</h1>
        </div>
      </header>

      <div className="stats">
        {cartoes.map((c) => (
          <Link
            key={c.rotulo}
            href={c.href}
            className={`stat ${c.tom === "alerta" ? "alert" : ""}`}
          >
            <span className="value">{numero(c.valor)}</span>
            <span className="label">{c.rotulo}</span>
          </Link>
        ))}
      </div>

      <h2>Precisa de atenção</h2>
      <ul className="atencao">
        {(attention ?? []).map((e) => (
          <li key={e.id}>
            <Link href={`/entregas/${e.id}`}>{e.titulo}</Link>
            <span className="muted">
              {[e.cliente, e.data_prevista ? `prazo ${e.data_prevista}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
        {(attention ?? []).length === 0 && (
          <li className="muted">Nada urgente por aqui.</li>
        )}
      </ul>
    </>
  );
}