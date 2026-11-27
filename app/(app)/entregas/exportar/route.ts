import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { listarEntregas, type FiltrosLista } from "@/lib/consultas";
import { situacaoDaEntrega } from "@/lib/fases";

// Exportação CSV do resultado filtrado da lista de entregas.
// Mesma fonte da tela (visão `entregas_detalhadas`), com o RLS da sessão.
export const dynamic = "force-dynamic";

const COLUNAS = [
  "id",
  "titulo",
  "cliente",
  "tipo",
  "subtipo",
  "fase",
  "data_prevista",
  "data_entrega",
  "situacao",
  "dias_atraso",
  "num_revisoes",
  "link",
] as const;

// Separador ";" porque é o que o Excel em pt-BR espera. O BOM no início faz o
// Excel reconhecer o UTF-8 (acentos).
const SEPARADOR = ";";

function celula(valor: unknown): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  // Neutraliza fórmulas: uma célula que começa com = + - @ seria executada
  // pelo Excel ao abrir o arquivo.
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

function filtrosDaUrl(url: URL): FiltrosLista {
  const situacao = url.searchParams.get("situacao") ?? "";
  const planejamento = url.searchParams.get("planejamento") ?? "";
  return {
    busca: url.searchParams.get("q")?.trim() || undefined,
    clienteId: url.searchParams.get("cliente")
      ? Number(url.searchParams.get("cliente"))
      : undefined,
    fase: url.searchParams.get("fase") || undefined,
    tipo: url.searchParams.get("tipo") || undefined,
    situacao:
      situacao === "atrasadas" || situacao === "vencidas" ? situacao : "",
    planejamento:
      planejamento === "pendente" || planejamento === "aprovado"
        ? planejamento
        : undefined,
    ordenar: url.searchParams.get("ord") || undefined,
    direcao: url.searchParams.get("dir") === "desc" ? "desc" : "asc",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filtros = filtrosDaUrl(url);
  const supabase = await criarClienteSupabaseServidor();
  const hoje = new Date().toISOString().slice(0, 10);

  const linhas: string[] = [COLUNAS.join(SEPARADOR)];
  const TAMANHO = 1000;

  // O PostgREST limita a resposta a 1000 linhas por consulta; paginamos até
  // esgotar o resultado em vez de confiar no teto.
  for (let pagina = 1; ; pagina += 1) {
    const { itens } = await listarEntregas(supabase, {
      ...filtros,
      pagina,
      porPagina: TAMANHO,
    });
    if (itens.length === 0) break;

    for (const e of itens) {
      const situacao = situacaoDaEntrega(
        {
          fase: e.fase,
          data_prevista: e.data_prevista,
          dias_atraso: e.dias_atraso,
        },
        hoje,
      );
      linhas.push(
        [
          e.id,
          e.titulo,
          e.cliente,
          e.tipo,
          e.subtipo,
          e.fase_rotulo,
          e.data_prevista,
          e.data_entrega,
          situacao.rotulo,
          e.dias_atraso,
          e.num_revisoes,
          e.link,
        ]
          .map(celula)
          .join(SEPARADOR),
      );
    }

    if (itens.length < TAMANHO) break;
  }

  const csv = `\uFEFF${linhas.join("\r\n")}\r\n`;
  const nome = `entregas-${hoje}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}