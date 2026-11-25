import Link from "next/link";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { FASES_ABERTAS } from "@/lib/fases";

const numero = (valor: number) => valor.toLocaleString("pt-BR");

function nomeCliente(valor: unknown): string {
  if (Array.isArray(valor)) return valor[0]?.nome ?? "";
  if (valor && typeof valor === "object" && "nome" in valor) {
    return String((valor as { nome?: string }).nome ?? "");
  }
  return "";
}

export default async function Inicio() {
  const supabase = await criarClienteSupabaseServidor();
  const hoje = new Date().toISOString().slice(0, 10);

  const [atraso, vencidas, aguardando, revisoes] = await Promise.all([
    supabase
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .or(`dias_atraso.gt.0,and(data_prevista.lt.${hoje},fase.in.(${FASES_ABERTAS.join(",")}))`),
    supabase
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .lt("data_prevista", hoje)
      .in("fase", FASES_ABERTAS as unknown as string[]),
    supabase
      .from("entregas")
      .select("id", { count: "exact", head: true })
      .eq("fase", "aguardando_aprovacao_entrega"),
    supabase
      .from("erros_importacao")
      .select("id", { count: "exact", head: true })
      .eq("resolvido", false),
  ]);

  const { data: attention } = await supabase
    .from("entregas")
    .select("id, titulo, data_prevista, fase, clientes ( nome )")
    .in("fase", ["ajuste_solicitado", "aguardando_cliente", "aguardando_aprovacao_entrega"])
    .order("data_prevista", { ascending: true, nullsFirst: false })
    .limit(8);

  const cartoes = [
    { rotulo: "Entregas em atraso", valor: atraso.count ?? 0, href: "/entregas?situacao=atrasadas", tom: "alerta" },
    { rotulo: "Vencidas hoje", valor: vencidas.count ?? 0, href: "/entregas?situacao=vencidas", tom: "alerta" },
    { rotulo: "Aguardando cliente", valor: aguardando.count ?? 0, href: "/entregas?fase=aguardando_aprovacao_entrega", tom: "info" },
    { rotulo: "Na fila de revisão", valor: revisoes.count ?? 0, href: "/revisao", tom: "neutro" },
  ];

  return (
    <>
      <header className="topo">
        <div>
          <p className="eyebrow">PlanOps</p>
          <h1>Início</h1>
        </div>
      </header>

      <div className="stats">
        {cartoes.map((c) => (
          <Link key={c.rotulo} href={c.href} className={`stat ${c.tom === "alerta" ? "alert" : ""}`}>
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
              {[nomeCliente(e.clientes), e.data_prevista ? `prazo ${e.data_prevista}` : ""]
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