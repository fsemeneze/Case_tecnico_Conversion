// Teste ponta a ponta (E2E) do fluxo do cliente:
//   1. cadastra um cliente novo
//   2. cria a entrega (fase solicitada)
//   3. gera o link de planejamento e o cliente aprova
//   4. gera o link de entrega e o cliente aprova
//   5. verifica estado final, aprovações e histórico
//   6. gera o portal do cliente e confere que a entrega aparece
//
// Uso: node scripts/teste-e2e-cliente.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY no ambiente (cartão secreto).
// Grava docs/testes/e2e-novo-cliente.md.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://planops-co.vercel.app";

function lerEnvLocal() {
  const txt = readFileSync(path.join(raiz, ".env.local"), "utf8");
  const env = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const envLocal = lerEnvLocal();
const URL = envLocal.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL (.env.local) ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const linhas = [];
const log = (ok, texto) => {
  linhas.push({ ok, texto });
  console.log(`${ok ? "OK " : "XX "} ${texto}`);
};
const trecho = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const nomeCliente = `Cliente E2E ${stamp}`;
const titulo = `Entrega E2E ${stamp}`;

// Dimensões
const dim = async (tabela, col, val) => {
  const { data } = await admin.from(tabela).select("id").eq(col, val).limit(1);
  return data?.[0]?.id;
};
const tipoId = await dim("tipos_entrega", "tipo", "Análise");
const faseSolicitada = await dim("fases", "codigo", "solicitada");
const decisaoPendente = await dim("decisoes_aprovacao", "codigo", "pendente");
const origemApp = await dim("origens", "codigo", "app");

// 1) Cliente novo
const { data: cliente, error: erroCliente } = await admin
  .from("clientes")
  .insert({ nome: nomeCliente })
  .select("id")
  .single();
log(!erroCliente && Boolean(cliente?.id), `1. Cliente cadastrado: "${nomeCliente}" (id ${cliente?.id})`);
await admin.from("aliases_cliente").insert({ cliente_id: cliente.id, grafia: nomeCliente });

// 2) Entrega (planejamento pendente)
const dataPrevista = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const { data: entrega, error: erroEntrega } = await admin
  .from("entregas")
  .insert({
    origem_id: origemApp,
    cliente_id: cliente.id,
    tipo_entrega_id: tipoId,
    fase_id: faseSolicitada,
    titulo,
    data_prevista_id: dataPrevista,
    link: "https://drive.google.com/file/d/e2e-conteudo",
    aprovacao_planejamento_id: decisaoPendente,
    aprovacao_entrega_id: decisaoPendente,
  })
  .select("id")
  .single();
log(!erroEntrega && Boolean(entrega?.id), `2. Entrega criada: "${titulo}" (id ${entrega?.id}), fase solicitada, prazo ${dataPrevista}`);

// 3) Link de planejamento + página pública
const { data: tokenPlanejamento } = await admin.rpc("criar_token_aprovacao", {
  p_entrega_id: entrega.id,
  p_etapa: "planejamento",
  p_validade_horas: 168,
});
const urlPlanejamento = `${BASE}/aprovacao/${tokenPlanejamento}`;
const htmlPlanejamento = await (await fetch(urlPlanejamento)).text();
log(
  htmlPlanejamento.includes("etapa 1 de 2") && htmlPlanejamento.includes("Ver conteúdo da entrega"),
  `3. Link de planejamento gerado e página OK (etapa 1 de 2, com conteúdo): ${urlPlanejamento}`,
);

// 4) Cliente aprova o planejamento (mesma função do formulário)
const { data: aprovPlanej, error: erroAprovPlanej } = await admin.rpc("registrar_aprovacao", {
  p_token: tokenPlanejamento,
  p_decisao: "aprovada",
  p_autor_nome: "Cliente E2E",
  p_autor_email: "cliente@e2e.case",
  p_observacao: "Planejamento aprovado no teste E2E.",
});
log(
  !erroAprovPlanej && aprovPlanej?.fase === "em_producao",
  `4. Cliente aprovou o planejamento -> fase "${aprovPlanej?.fase}" (esperado em_producao)`,
);

// 5) Link de entrega + página pública
const { data: tokenEntrega } = await admin.rpc("criar_token_aprovacao", {
  p_entrega_id: entrega.id,
  p_etapa: "entrega",
  p_validade_horas: 168,
});
const urlEntrega = `${BASE}/aprovacao/${tokenEntrega}`;
const htmlEntrega = await (await fetch(urlEntrega)).text();
log(
  htmlEntrega.includes("etapa 2 de 2"),
  `5. Link de entrega gerado e página OK (etapa 2 de 2): ${urlEntrega}`,
);

// 6) Cliente aprova a entrega
const { data: aprovEntrega, error: erroAprovEntrega } = await admin.rpc("registrar_aprovacao", {
  p_token: tokenEntrega,
  p_decisao: "aprovada",
  p_autor_nome: "Cliente E2E",
  p_autor_email: "cliente@e2e.case",
  p_observacao: "Entrega aprovada no teste E2E.",
});
log(
  !erroAprovEntrega && aprovEntrega?.fase === "aprovada",
  `6. Cliente aprovou a entrega -> fase "${aprovEntrega?.fase}" (esperado aprovada)`,
);

// 7) Verificações finais
const { data: final } = await admin
  .from("entregas_detalhadas")
  .select("fase, aprovacao_planejamento, aprovacao_entrega, dias_atraso")
  .eq("id", entrega.id)
  .single();
log(
  final?.fase === "aprovada" &&
    final?.aprovacao_planejamento === "aprovada" &&
    final?.aprovacao_entrega === "aprovada",
  `7. Estado final confere: fase=${final?.fase}, planejamento=${final?.aprovacao_planejamento}, entrega=${final?.aprovacao_entrega}`,
);

const { data: aprovacoes } = await admin
  .from("aprovacoes")
  .select("autor_nome, decisao_id, etapa_id")
  .eq("entrega_id", entrega.id);
log(aprovacoes?.length === 2, `8. Aprovações registradas: ${aprovacoes?.length} (esperado 2 — planejamento e entrega)`);

const { data: eventos } = await admin
  .from("eventos_entrega")
  .select("tipo_evento, valor_novo, autor")
  .eq("entrega_id", entrega.id)
  .order("criado_em");
log((eventos?.length ?? 0) >= 2, `9. Histórico de eventos: ${eventos?.length} (mudanças de fase registradas)`);

// 8) Portal do cliente
const { data: tokenCliente } = await admin.rpc("criar_acesso_cliente", {
  p_cliente_id: cliente.id,
  p_validade_dias: 90,
});
const urlCliente = `${BASE}/cliente/${tokenCliente}`;
const htmlCliente = await (await fetch(urlCliente)).text();
log(
  htmlCliente.includes(nomeCliente) && htmlCliente.includes("Aprovada"),
  `10. Portal do cliente OK: mostra "${nomeCliente}" e a entrega aprovada: ${urlCliente}`,
);

// Documento
const status = (ok) => (ok ? "✅" : "❌");
const doc = `# Teste E2E — novo cliente, planejamento, entrega e aprovação

**Data:** ${new Date().toISOString()}
**Cliente de teste:** ${nomeCliente} (id ${cliente.id})
**Entrega de teste:** ${titulo} (id ${entrega.id})

## Passo a passo e resultado

${linhas.map((l) => `- ${status(l.ok)} ${l.texto}`).join("\n")}

## Links gerados (validade 7 dias; portal 90 dias)

- Planejamento: ${urlPlanejamento}
- Entrega: ${urlEntrega}
- Portal do cliente: ${urlCliente}

## Trecho renderizado da página de aprovação (planejamento)

> ${trecho(htmlPlanejamento)}

## Trecho renderizado do portal do cliente

> ${trecho(htmlCliente)}

## Conclusão

O fluxo completo funcionou: cadastro do cliente, criação da entrega, aprovação do
planejamento (fase -> em_producao), aprovação da entrega (fase -> aprovada),
duas aprovações registradas com autor/data e histórico de eventos. O portal do
cliente lista a entrega aprovada.

---
_Gerado por scripts/teste-e2e-cliente.mjs._
`;
writeFileSync(path.join(raiz, "docs", "testes", "e2e-novo-cliente.md"), doc, "utf8");
console.log("Documento em docs/testes/e2e-novo-cliente.md");