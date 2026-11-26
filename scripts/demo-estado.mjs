// Estado de demonstração do PlanHub.
//
// Cria (ou devolve ao estado inicial) três entregas do cliente "Escola Saber
// Mais", cobrindo o que a apresentação mostra:
//
//   1. aguardando o planejamento do cliente   → link de planejamento ativo
//   2. aguardando a aprovação da entrega      → link de entrega ativo
//   3. em produção com prazo vencido           → aparece como atraso no app
//
// Por que existe: aprovar pelo link muda a fase e consome o token. Sem isto,
// cada tomada do vídeo (e cada teste do avaliador) exigiria editar o banco à mão.
//
// Uso:
//   node scripts/demo-estado.mjs            (recria o estado inicial)
//   node scripts/demo-estado.mjs --status   (só mostra como está agora)
//
// Requer SUPABASE_SERVICE_ROLE_KEY; a URL sai do .env.local. A limpeza atinge
// apenas as entregas marcadas com origem_linha->>'demo': nada importado é tocado.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function lerEnvLocal() {
  const env = {};
  try {
    const txt = readFileSync(path.join(raiz, ".env.local"), "utf8");
    for (const linha of txt.split(/\r?\n/)) {
      const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch {
    // Sem .env.local: vale o ambiente.
  }
  return env;
}

const env = { ...lerEnvLocal(), ...process.env };
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = (env.APP_URL || "https://planhub-co.vercel.app").replace(/\/$/, "");

if (!URL || !SERVICE) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL (.env.local) e SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLIENTE = "Escola Saber Mais";

const ESTADOS = [
  {
    demo: "planejamento",
    titulo: "Planejamento: calendário editorial de dezembro",
    tipo: "Conteúdo",
    subtipo: "Artigo",
    fase: "aguardando_cliente",
    aprovacaoPlanejamento: "pendente",
    aprovacaoEntrega: "pendente",
    solicitacao: -5,
    previsto: 10,
    entrega: null,
    revisoes: 0,
    etapaToken: "planejamento",
  },
  {
    demo: "entrega",
    titulo: "Relatório mensal de novembro",
    tipo: "Relatório",
    subtipo: null,
    fase: "aguardando_aprovacao_entrega",
    aprovacaoPlanejamento: "aprovada",
    aprovacaoEntrega: "pendente",
    solicitacao: -12,
    previsto: 2,
    entrega: -1,
    revisoes: 1,
    etapaToken: "entrega",
  },
  {
    demo: "vencida",
    titulo: "Auditoria técnica do site",
    tipo: "Análise",
    subtipo: "Auditoria técnica do site",
    fase: "em_producao",
    aprovacaoPlanejamento: "aprovada",
    aprovacaoEntrega: "pendente",
    solicitacao: -20,
    previsto: -6,
    entrega: null,
    revisoes: 0,
    etapaToken: null,
  },
];

// Data de referência em UTC, como o app usa para "hoje".
function dia(offset) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function dimensoes() {
  const [clientes, fases, decisoes, tipos] = await Promise.all([
    admin.from("clientes").select("id, nome").eq("nome", CLIENTE).maybeSingle(),
    admin.from("fases").select("id, codigo"),
    admin.from("decisoes_aprovacao").select("id, codigo"),
    admin.from("tipos_entrega").select("id, tipo, subtipo"),
  ]);
  if (clientes.error || !clientes.data) {
    throw new Error(`Cliente "${CLIENTE}" não encontrado.`);
  }
  const mapa = (linhas) => new Map((linhas ?? []).map((l) => [l.codigo, l.id]));
  return {
    clienteId: clientes.data.id,
    fases: mapa(fases.data),
    decisoes: mapa(decisoes.data),
    tipos: tipos.data ?? [],
  };
}

function tipoId(tipos, tipo, subtipo) {
  const achado = tipos.find((t) => t.tipo === tipo && (t.subtipo ?? null) === subtipo);
  if (!achado) throw new Error(`Tipo não encontrado: ${tipo} / ${subtipo ?? "—"}`);
  return achado.id;
}

async function demoAtuais(clienteId) {
  const { data, error } = await admin
    .from("entregas")
    .select("id, titulo, origem_linha")
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((e) => e.origem_linha?.demo);
}

const dim = await dimensoes();
const atuais = await demoAtuais(dim.clienteId);
const porChave = new Map(atuais.map((e) => [e.origem_linha.demo, e.id]));

if (process.argv.includes("--status")) {
  const { data: linhas } = await admin
    .from("entregas_detalhadas")
    .select("id, titulo, fase, fase_rotulo, aprovacao_planejamento, aprovacao_entrega, data_prevista")
    .in("id", [...porChave.values(), -1]);
  console.log(`Estado de demonstração (${CLIENTE})`);
  for (const estado of ESTADOS) {
    const linha = (linhas ?? []).find((l) => l.id === porChave.get(estado.demo));
    if (!linha) {
      console.log(`- ${estado.demo}: ainda não criada`);
      continue;
    }
    console.log(
      `- #${linha.id} ${linha.titulo}\n  ${linha.fase_rotulo} · planejamento ${linha.aprovacao_planejamento} · entrega ${linha.aprovacao_entrega} · prazo ${linha.data_prevista ?? "—"}`,
    );
  }
  process.exit(0);
}

const ids = [];

for (const estado of ESTADOS) {
  const campos = {
    origem_id: 2, // app
    cliente_id: dim.clienteId,
    tipo_entrega_id: tipoId(dim.tipos, estado.tipo, estado.subtipo),
    fase_id: dim.fases.get(estado.fase),
    titulo: estado.titulo,
    data_solicitacao_id: dia(estado.solicitacao),
    data_prevista_id: dia(estado.previsto),
    data_entrega_id: estado.entrega === null ? null : dia(estado.entrega),
    aprovacao_planejamento_id: dim.decisoes.get(estado.aprovacaoPlanejamento),
    aprovacao_entrega_id: dim.decisoes.get(estado.aprovacaoEntrega),
    num_revisoes: estado.revisoes,
    observacoes:
      "Entrega de demonstração, criada para o vídeo e para os testes de aprovação.",
  };

  const existente = porChave.get(estado.demo);
  if (existente) {
    const { error } = await admin.from("entregas").update(campos).eq("id", existente);
    if (error) throw new Error(`Atualizar #${existente}: ${error.message}`);
    ids.push(existente);
  } else {
    const { data, error } = await admin
      .from("entregas")
      .insert({ ...campos, origem_linha: { demo: estado.demo } })
      .select("id")
      .single();
    if (error) throw new Error(`Criar "${estado.titulo}": ${error.message}`);
    ids.push(data.id);
  }
}

// Volta o histórico ao estado inicial: sem decisões, eventos ou avisos das
// tomadas anteriores. O update acima também gera eventos, por isso a limpeza
// vem depois dele.
for (const tabela of ["aprovacoes", "eventos_entrega"]) {
  const { error } = await admin.from(tabela).delete().in("entrega_id", ids);
  if (error) throw new Error(`Limpar ${tabela}: ${error.message}`);
}
await admin.from("notificacoes").delete().in("entidade_id", ids);

// Links de aprovação novos (30 dias). Emitir um token já invalida o anterior
// da mesma entrega e etapa.
const links = [];
for (const estado of ESTADOS) {
  if (!estado.etapaToken) continue;
  const entregaId = ids[ESTADOS.indexOf(estado)];
  const { data: token, error } = await admin.rpc("criar_token_aprovacao", {
    p_entrega_id: entregaId,
    p_etapa: estado.etapaToken,
    p_validade_horas: 720,
  });
  if (error) throw new Error(`Token de ${estado.demo}: ${error.message}`);
  links.push({ demo: estado.demo, titulo: estado.titulo, entregaId, url: `${APP}/aprovacao/${token}` });
}

console.log(`Estado de demonstração recriado (${CLIENTE}):`);
for (const [i, estado] of ESTADOS.entries()) {
  console.log(`- #${ids[i]} ${estado.titulo} — ${estado.fase.replace(/_/g, " ")}`);
}
for (const link of links) {
  console.log(`\nAprovação (${link.demo}) · entrega #${link.entregaId}\n${link.url}`);
}
console.log(
  `\nPortal do cliente: gere em Clientes → "Gerar link" (um link novo revoga o anterior).`,
);
