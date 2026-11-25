// Testes adicionais (replica fiel de lib/consultas.ts e lib/validacao.ts):
//   1. Listagem: filtros, busca e paginação
//   2. Cadastro: validação + inserção que aparece na lista
//   3. Aprovação: recusa, uso único do token e caminho até a entrega
//
// Uso: node scripts/testar-mais.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY no ambiente (cartão secreto).
// Gera docs/testes/listagem.md, cadastro.md e aprovacao-recusa.md.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function lerEnvLocal() {
  const txt = readFileSync(path.join(raiz, ".env.local"), "utf8");
  const env = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = lerEnvLocal();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL (.env.local) ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const scoped = admin;

// --- Cópia fiel de lib/consultas.ts (listarEntregas) ---
const FASES_ABERTAS = ["solicitada", "em_producao", "aguardando_cliente", "aguardando_aprovacao_entrega", "ajuste_solicitado"];
async function listarEntregas(supabase, filtros) {
  const porPagina = filtros.porPagina ?? 50;
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const hoje = new Date().toISOString().slice(0, 10);
  let consulta = supabase.from("entregas_detalhadas").select("*", { count: "exact" });
  if (filtros.busca) consulta = consulta.ilike("titulo", `%${filtros.busca}%`);
  if (filtros.clienteId) consulta = consulta.eq("cliente_id", filtros.clienteId);
  if (filtros.fase) consulta = consulta.eq("fase", filtros.fase);
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.situacao === "atrasadas") {
    consulta = consulta.or(`dias_atraso.gt.0,and(data_prevista.lt.${hoje},fase.in.(${FASES_ABERTAS.join(",")}))`);
  }
  if (filtros.situacao === "vencidas") {
    consulta = consulta.lt("data_prevista", hoje).in("fase", FASES_ABERTAS);
  }
  const offset = (pagina - 1) * porPagina;
  const { data, count } = await consulta
    .order("data_prevista", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .range(offset, offset + porPagina - 1);
  return { itens: data ?? [], total: count ?? 0 };
}

// --- Cópia fiel de lib/validacao.ts (schemaEntrega) ---
const texto = (rotulo, maximo = 200) =>
  z.string().trim().max(maximo, `${rotulo}: no máximo ${maximo} caracteres`).optional().default("");
const data = z.string().trim().optional().default("").refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida (use yyyy-mm-dd).");
const schemaEntrega = z.object({
  titulo: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(200),
  cliente_id: z.string().optional().default(""),
  novo_cliente: z.string().trim().max(200).optional().default(""),
  tipo: z.enum(["Relatório", "Análise", "Conteúdo"]),
  subtipo: texto("Subtipo", 80),
  squad: texto("Squad", 80),
  responsavel: texto("Responsável", 80),
  data_solicitacao: data,
  data_prevista: data,
  link: z.string().trim().optional().default("").refine((v) => v === "" || v.startsWith("https://") || v.startsWith("http://"), "O link deve começar com http:// ou https://."),
  observacoes: z.string().trim().max(1000, "Observações: no máximo 1000 caracteres.").optional().default(""),
});
const primeiroErro = (r) => (r.success ? null : r.error.issues[0]?.message ?? "Dados inválidos.");

const hoje = new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

function novoBloco() {
  const linhas = [];
  const check = (ok, texto) => {
    linhas.push({ ok, texto });
    console.log(`${ok ? "OK " : "XX "} ${texto}`);
  };
  const doc = (titulo, extra = "") =>
    `# ${titulo}\n\n${linhas.map((l) => `- ${l.ok ? "✅" : "❌"} ${l.texto}`).join("\n")}\n${extra}\n---\n_Gerado por scripts/testar-mais.mjs em ${new Date().toISOString()}_\n`;
  return { check, doc };
}

// 1) Listagem
const L = novoBloco();
const base = await listarEntregas(scoped, {});
L.check(base.total > 0, `Baseline: ${base.total} entregas (página 1 com ${base.itens.length})`);

const busca = await listarEntregas(scoped, { busca: "Relatório" });
L.check(busca.total > 0 && busca.itens.every((i) => i.titulo.toLowerCase().includes("relatório")), `Busca "Relatório": ${busca.total} resultados, todos os títulos contêm o termo`);

const vazio = await listarEntregas(scoped, { busca: "zzzz-inexistente-xyz" });
L.check(vazio.total === 0, `Busca inexistente: ${vazio.total} (esperado 0)`);

const cid = base.itens[0].cliente_id;
const porCliente = await listarEntregas(scoped, { clienteId: cid });
L.check(porCliente.total > 0 && porCliente.itens.every((i) => i.cliente_id === cid), `Filtro por cliente (${cid}): ${porCliente.total} entregas, todas do cliente`);

const porFase = await listarEntregas(scoped, { fase: "aprovada" });
L.check(porFase.itens.every((i) => i.fase === "aprovada"), `Filtro por fase "aprovada": ${porFase.total}, todas aprovadas`);

const porTipo = await listarEntregas(scoped, { tipo: "Conteúdo" });
L.check(porTipo.itens.every((i) => i.tipo === "Conteúdo"), `Filtro por tipo "Conteúdo": ${porTipo.total}, todas Conteúdo`);

const atrasadas = await listarEntregas(scoped, { situacao: "atrasadas" });
L.check(atrasadas.itens.every((i) => (i.dias_atraso ?? 0) > 0 || (i.fase_grupo === "aberta" && i.data_prevista && i.data_prevista < hoje)), `Filtro "atrasadas": ${atrasadas.total}, todas em atraso pela definição D8`);

const vencidas = await listarEntregas(scoped, { situacao: "vencidas" });
L.check(vencidas.itens.every((i) => i.fase_grupo === "aberta" && i.data_prevista && i.data_prevista < hoje), `Filtro "vencidas": ${vencidas.total}, todas abertas com prazo vencido`);

const p1 = await listarEntregas(scoped, { porPagina: 10, pagina: 1 });
const p2 = await listarEntregas(scoped, { porPagina: 10, pagina: 2 });
L.check(p1.itens.length === 10 && p2.itens.length === 10 && p1.itens[0].id !== p2.itens[0].id, `Paginação: páginas 1 e 2 com 10 itens e ids distintos`);

const combinado = await listarEntregas(scoped, { clienteId: cid, tipo: "Conteúdo" });
L.check(combinado.itens.every((i) => i.cliente_id === cid && i.tipo === "Conteúdo"), `Filtro combinado (cliente + tipo): ${combinado.total} entregas`);
writeFileSync(path.join(raiz, "docs/testes/listagem.md"), L.doc("Teste — Listagem de entregas (filtros, busca e paginação)"), "utf8");

// 2) Cadastro
const C = novoBloco();
C.check(schemaEntrega.safeParse({ titulo: "Teste cadastro", tipo: "Conteúdo", link: "https://x" }).success, "Payload válido aceito");
C.check(!schemaEntrega.safeParse({ titulo: "ab", tipo: "Conteúdo" }).success, `Título curto rejeitado: ${primeiroErro(schemaEntrega.safeParse({ titulo: "ab", tipo: "Conteúdo" }))}`);
C.check(!schemaEntrega.safeParse({ titulo: "Teste", tipo: "Outro" }).success, "Tipo inválido rejeitado");
C.check(!schemaEntrega.safeParse({ titulo: "Teste", tipo: "Conteúdo", link: "ftp://x" }).success, `Link inválido rejeitado: ${primeiroErro(schemaEntrega.safeParse({ titulo: "Teste", tipo: "Conteúdo", link: "ftp://x" }))}`);
C.check(!schemaEntrega.safeParse({ titulo: "Teste", tipo: "Conteúdo", data_prevista: "abc" }).success, "Data inválida rejeitada");

const dim = async (tabela, col, val) => {
  const { data } = await admin.from(tabela).select("id").eq(col, val).limit(1);
  return data?.[0]?.id;
};
const tipoId = await dim("tipos_entrega", "tipo", "Conteúdo");
const faseId = await dim("fases", "codigo", "solicitada");
const decisaoId = await dim("decisoes_aprovacao", "codigo", "pendente");
const origemId = await dim("origens", "codigo", "app");

const tituloNovo = `Cadastro E2E ${stamp}`;
const { data: criada } = await admin.from("entregas").insert({
  origem_id: origemId, cliente_id: cid, tipo_entrega_id: tipoId, fase_id: faseId,
  titulo: tituloNovo, data_prevista_id: new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10),
  link: "https://drive.google.com/file/d/e2e-cadastro",
  aprovacao_planejamento_id: decisaoId, aprovacao_entrega_id: decisaoId,
}).select("id").single();
C.check(Boolean(criada?.id), `Entrega cadastrada (id ${criada?.id}) com cliente ${cid}, tipo Conteúdo, fase solicitada`);

const naLista = await listarEntregas(scoped, { busca: tituloNovo });
C.check(naLista.total === 1 && naLista.itens[0].id === criada.id && naLista.itens[0].fase === "solicitada", `Nova entrega aparece na listagem (busca por título) na fase solicitada`);
writeFileSync(path.join(raiz, "docs/testes/cadastro.md"), C.doc("Teste — Cadastro de nova entrega", `\n**Entrega de teste:** ${tituloNovo} (id ${criada.id})\n`), "utf8");

// 3) Aprovação: recusa, uso único, caminho até a entrega
const A = novoBloco();
const t1 = (await admin.rpc("criar_token_aprovacao", { p_entrega_id: criada.id, p_etapa: "planejamento", p_validade_horas: 168 })).data;
const rec = await admin.rpc("registrar_aprovacao", { p_token: t1, p_decisao: "recusada", p_autor_nome: "Cliente E2E", p_autor_email: "cliente@e2e.case", p_observacao: "Precisa ajustar o planejamento." });
A.check(rec?.data?.fase === "ajuste_solicitado", `Recusa do planejamento -> fase "${rec?.data?.fase}" (esperado ajuste_solicitado)`);

const reuso = await admin.rpc("registrar_aprovacao", { p_token: t1, p_decisao: "aprovada", p_autor_nome: "Cliente E2E" });
A.check(Boolean(reuso?.error), `Reuso do mesmo token bloqueado (uso único): ${reuso?.error?.message ?? "sem erro"}`);

const t2 = (await admin.rpc("criar_token_aprovacao", { p_entrega_id: criada.id, p_etapa: "planejamento", p_validade_horas: 168 })).data;
const apr = await admin.rpc("registrar_aprovacao", { p_token: t2, p_decisao: "aprovada", p_autor_nome: "Cliente E2E" });
A.check(apr?.data?.fase === "em_producao", `Novo link de planejamento aprovado -> fase "${apr?.data?.fase}" (esperado em_producao)`);

const t3 = (await admin.rpc("criar_token_aprovacao", { p_entrega_id: criada.id, p_etapa: "entrega", p_validade_horas: 168 })).data;
const apr2 = await admin.rpc("registrar_aprovacao", { p_token: t3, p_decisao: "aprovada", p_autor_nome: "Cliente E2E" });
A.check(apr2?.data?.fase === "aprovada", `Entrega aprovada -> fase "${apr2?.data?.fase}" (esperado aprovada)`);

const { data: aps } = await admin.from("aprovacoes").select("id").eq("entrega_id", criada.id);
A.check((aps?.length ?? 0) === 3, `Aprovações registradas: ${aps?.length} (recusa + planejamento + entrega)`);
writeFileSync(path.join(raiz, "docs/testes/aprovacao-recusa.md"), A.doc("Teste — Aprovação: recusa, uso único e caminho até a entrega", `\n**Entrega de teste:** ${tituloNovo} (id ${criada.id})\n`), "utf8");

await admin.from("entregas").delete().eq("id", criada.id);
console.log("Limpeza: entrega de teste removida.");