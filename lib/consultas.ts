import type { SupabaseClient } from "@supabase/supabase-js";

// Camada de leitura do PlanHub. O app nunca consulta tabelas base:
// lê das visões (entregas_detalhadas, indicadores_mensais, eventos_detalhados)
// e escreve nas tabelas do modelo, respeitando o RLS.
// Assim a regra de negócio fica no banco, e o app só apresenta.

export type EntregaLista = {
  id: number;
  legacy_id: number | null;
  titulo: string;
  tipo: string;
  subtipo: string | null;
  cliente_id: number;
  cliente: string;
  squad_id: number | null;
  squad: string | null;
  pessoa_id: number | null;
  responsavel: string | null;
  fase_id: number;
  fase: string;
  fase_rotulo: string;
  fase_grupo: "aberta" | "final" | "cancelada";
  data_solicitacao: string | null;
  data_prevista: string | null;
  data_entrega: string | null;
  aprovacao_planejamento_id: number;
  aprovacao_planejamento: string;
  aprovacao_entrega_id: number;
  aprovacao_entrega: string;
  num_revisoes: number | null;
  link: string | null;
  observacoes: string | null;
  flags: string[];
  origem_id: number;
  origem: string;
  dias_atraso: number | null;
  dias_ciclo: number | null;
  dias_restantes: number | null;
};

export type FiltrosLista = {
  busca?: string;
  clienteId?: number;
  fase?: string;
  tipo?: string;
  situacao?: "atrasadas" | "vencidas" | "";
  pagina?: number;
  porPagina?: number;
  ordenar?: string;
  direcao?: "asc" | "desc";
};

// Colunas que a lista pode ordenar. Só estas valem: o valor vem da URL e
// vira nome de coluna no PostgREST, então precisa de lista branca.
const ORDENACAO: Record<string, string> = {
  titulo: "titulo",
  cliente: "cliente",
  tipo: "tipo",
  fase: "fase_rotulo",
  data_prevista: "data_prevista",
  situacao: "dias_atraso",
};

const FASES_ABERTAS = [
  "solicitada",
  "em_producao",
  "aguardando_cliente",
  "aguardando_aprovacao_entrega",
  "ajuste_solicitado",
];

export async function listarEntregas(
  supabase: SupabaseClient,
  filtros: FiltrosLista,
): Promise<{ itens: EntregaLista[]; total: number }> {
  const porPagina = filtros.porPagina ?? 50;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const hoje = new Date().toISOString().slice(0, 10);

  let consulta = supabase
    .from("entregas_detalhadas")
    .select("*", { count: "exact" });

  if (filtros.busca) {
    consulta = consulta.ilike("titulo", `%${filtros.busca}%`);
  }
  if (filtros.clienteId) {
    consulta = consulta.eq("cliente_id", filtros.clienteId);
  }
  if (filtros.fase) {
    consulta = consulta.eq("fase", filtros.fase);
  }
  if (filtros.tipo) {
    consulta = consulta.eq("tipo", filtros.tipo);
  }
  if (filtros.situacao === "atrasadas") {
    // D8: concluída após o prazo OU em aberto com prazo vencido.
    consulta = consulta.or(
      `dias_atraso.gt.0,and(data_prevista.lt.${hoje},fase.in.(${FASES_ABERTAS.join(",")}))`,
    );
  }
  if (filtros.situacao === "vencidas") {
    consulta = consulta
      .lt("data_prevista", hoje)
      .in("fase", FASES_ABERTAS);
  }

  const offset = (pagina - 1) * porPagina;
  const coluna = filtros.ordenar ? ORDENACAO[filtros.ordenar] : undefined;
  const { data, count } = await consulta
    .order(coluna ?? "data_prevista", {
      ascending: coluna ? filtros.direcao !== "desc" : true,
      nullsFirst: false,
    })
    .order("id", { ascending: true })
    .range(offset, offset + porPagina - 1);

  return { itens: (data ?? []) as EntregaLista[], total: count ?? 0 };
}

export async function buscarEntrega(
  supabase: SupabaseClient,
  id: number,
): Promise<EntregaLista | null> {
  const { data } = await supabase
    .from("entregas_detalhadas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as EntregaLista | null) ?? null;
}

export async function listarClientes(
  supabase: SupabaseClient,
): Promise<{ id: number; nome: string }[]> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nome")
    .order("nome");
  return (data ?? []) as { id: number; nome: string }[];
}

export async function contarIndicadores(
  supabase: SupabaseClient,
): Promise<{
  atraso: number;
  vencidas: number;
  aguardando: number;
  revisao: number;
}> {
  const hoje = new Date().toISOString().slice(0, 10);
  // Fila de encerramento (D13): abertas vencidas há mais de 90 dias, sem
  // cancelamento ativo. Entra na "fila de revisão" para o número bater com
  // a tela /revisao, que lista essas linhas junto dos erros.
  const limite90 = new Date(Date.now() - 90 * 86400000)
    .toISOString()
    .slice(0, 10);

  const [atraso, vencidas, aguardando, revisao, abertas90, canceladas] =
    await Promise.all([
      supabase
        .from("entregas_detalhadas")
        .select("id", { count: "exact", head: true })
        .or(
          `dias_atraso.gt.0,and(data_prevista.lt.${hoje},fase.in.(${FASES_ABERTAS.join(",")}))`,
        ),
      supabase
        .from("entregas_detalhadas")
        .select("id", { count: "exact", head: true })
        .lt("data_prevista", hoje)
        .in("fase", FASES_ABERTAS),
      supabase
        .from("entregas_detalhadas")
        .select("id", { count: "exact", head: true })
        .eq("fase", "aguardando_aprovacao_entrega"),
      supabase
        .from("erros_importacao")
        .select("id", { count: "exact", head: true })
        .eq("resolvido", false),
      supabase
        .from("entregas_detalhadas")
        .select("id")
        .in("fase_grupo", ["aberta"])
        .lt("data_prevista", limite90),
      supabase
        .from("encerramentos")
        .select("entrega_id")
        .eq("decisao", "cancelada"),
    ]);

  const canceladasSet = new Set(
    (canceladas.data ?? []).map((c) => Number(c.entrega_id)),
  );
  const paradas = (abertas90.data ?? []).filter(
    (e) => !canceladasSet.has(Number(e.id)),
  ).length;

  return {
    atraso: atraso.count ?? 0,
    vencidas: vencidas.count ?? 0,
    aguardando: aguardando.count ?? 0,
    revisao: (revisao.count ?? 0) + paradas,
  };
}

export async function listarEventos(
  supabase: SupabaseClient,
  entregaId: number,
): Promise<
  {
    id: string;
    tipo_evento: string;
    campo: string | null;
    valor_antigo: string | null;
    valor_novo: string | null;
    autor: string | null;
    criado_em: string;
    fase_origem: string | null;
    fase_destino: string | null;
  }[]
> {
  const { data } = await supabase
    .from("eventos_detalhados")
    .select("*")
    .eq("entrega_id", entregaId)
    .order("criado_em", { ascending: false })
    .limit(50);
  return (data ?? []) as never;
}

export async function listarAprovacoes(
  supabase: SupabaseClient,
  entregaId: number,
): Promise<
  {
    id: string;
    etapa: string;
    decisao: string;
    autor_nome: string;
    autor_email: string | null;
    autor_ip: string | null;
    observacao: string | null;
    criado_em: string;
  }[]
> {
  const { data } = await supabase
    .from("aprovacoes")
    .select(
      "id, etapa_id, decisao_id, autor_nome, autor_email, autor_ip, observacao, criado_em, etapas_aprovacao!inner(codigo), decisoes_aprovacao!inner(codigo)",
    )
    .eq("entrega_id", entregaId)
    .order("criado_em", { ascending: false });

  return (data ?? []).map((linha: Record<string, unknown>) => {
    const etapa = linha.etapas_aprovacao as { codigo: string };
    const decisao = linha.decisoes_aprovacao as { codigo: string };
    return {
      id: String(linha.id),
      etapa: etapa.codigo,
      decisao: decisao.codigo,
      autor_nome: String(linha.autor_nome),
      autor_email: (linha.autor_email as string | null) ?? null,
      autor_ip: (linha.autor_ip as string | null) ?? null,
      observacao: (linha.observacao as string | null) ?? null,
      criado_em: String(linha.criado_em),
    };
  });
}