// Remove a verificação em duas etapas (TOTP) de um usuário.
//
//   node scripts/reset-mfa.mjs [email]
//
// Sem argumento, usa admin@planhub.case. Requer SUPABASE_SERVICE_ROLE_KEY no
// ambiente (cartão secreto) e .env.local com a URL do projeto.
//
// Idempotente: rodar de novo não faz nada. Se o fator removido era verificado,
// o usuário é desconectado de todas as sessões (comportamento do provedor).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const envLocal = lerEnvLocal();
const URL = envLocal.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL (.env.local) ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const email = (process.argv[2] || "admin@planhub.case").trim().toLowerCase();
const headers = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

// 1. Localiza o usuário pelo e-mail (lista paginada).
let user = null;
for (let page = 1; page <= 20 && !user; page += 1) {
  const r = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers });
  if (!r.ok) {
    console.error(`Falha ao listar usuários: HTTP ${r.status}`);
    process.exit(1);
  }
  const data = await r.json();
  user = (data.users ?? []).find((u) => u.email?.toLowerCase() === email);
}
if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

// 2. Lista os fatores.
const lr = await fetch(`${URL}/auth/v1/admin/users/${user.id}/factors`, { headers });
if (!lr.ok) {
  console.error(`Falha ao listar fatores: HTTP ${lr.status}`);
  process.exit(1);
}
const fatores = (await lr.json()).factors ?? [];
if (fatores.length === 0) {
  console.log(`${email}: nenhum fator cadastrado — nada a fazer.`);
  process.exit(0);
}

// 3. Remove um a um.
let removidos = 0;
for (const f of fatores) {
  const dr = await fetch(`${URL}/auth/v1/admin/users/${user.id}/factors/${f.id}`, {
    method: "DELETE",
    headers,
  });
  if (!dr.ok && dr.status !== 204) {
    console.error(`Falha ao remover ${f.id}: HTTP ${dr.status}`);
  } else {
    removidos += 1;
    console.log(`removido ${f.id} (${f.friendly_name ?? f.factor_type})`);
  }
}

console.log(`${email}: ${removidos} fator(es) removido(s).`);