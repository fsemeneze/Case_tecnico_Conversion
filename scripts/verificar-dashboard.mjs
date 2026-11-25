// Verifica o dashboard renderizado de forma determinística:
// faz login na API de Auth, monta o cookie de sessão do @supabase/ssr e
// busca /dashboard já autenticado. Salva o HTML e extrai os KPIs.
//
// Uso: node scripts/verificar-dashboard.mjs

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const linha of readFileSync(path.join(raiz, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const REF = new globalThis.URL(SUPA_URL).hostname.split(".")[0];
const BASE = "https://planops-co.vercel.app";

const login = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: PUB, "Content-Type": "application/json" },
  body: JSON.stringify({ email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_SENHA }),
});
const sessao = await login.json();
if (!sessao.access_token) {
  console.error("Login falhou:", sessao);
  process.exit(1);
}
console.log("Login OK:", sessao.user.email);

const valor = "base64-" + Buffer.from(JSON.stringify(sessao)).toString("base64url");
const cookie = `sb-${REF}-auth-token=${valor}`;

const resp = await fetch(`${BASE}/dashboard`, {
  headers: { Cookie: cookie },
  redirect: "manual",
});
const html = await resp.text();
console.log("HTTP", resp.status, "bytes", html.length);

const trechos = [
  "Dashboard",
  "Atraso por tipo",
  "Entregas por mês",
  "Distribuição por fase",
  "Clientes com mais atraso",
  "Taxa de atraso",
];
for (const t of trechos) console.log(html.includes(t) ? `OK  contém "${t}"` : `XX  falta "${t}"`);

// KPIs (texto do topo)
const texto = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();
console.log("\nTrecho:", texto.slice(0, 500));

const saida = path.join(process.env.TEMP || raiz, "dashboard-render.html");
writeFileSync(saida, html, "utf8");
console.log("\nHTML salvo em", saida);