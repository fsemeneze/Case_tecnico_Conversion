// Cria uma conta de operador para cada responsável da planilha, vinculada ao
// squad em que ele mais atua. Idempotente: rodar de novo não duplica.
//
// Uso: node scripts/criar-usuarios-squad.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY no ambiente (cartão secreto) e .env.local
// com a URL e a chave publicável.
//
// As senhas são geradas e gravadas em .credenciais-squad.md (ignorado pelo
// git) — envie pelo canal combinado, nunca para o repositório.

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const slug = (nome) =>
  nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

const senha = () => `${randomBytes(9).toString("base64url")}A1!`;

const { data: pessoas } = await admin.from("pessoas").select("id, nome");
const { data: squads } = await admin.from("squads").select("id, nome");
const { data: contagens } = await admin
  .from("entregas")
  .select("pessoa_id, squad_id")
  .not("pessoa_id", "is", null);

const squadDoPessoa = new Map();
for (const linha of contagens ?? []) {
  if (!linha.squad_id) continue;
  const atual = squadDoPessoa.get(linha.pessoa_id) ?? new Map();
  atual.set(linha.squad_id, (atual.get(linha.squad_id) ?? 0) + 1);
  squadDoPessoa.set(linha.pessoa_id, atual);
}

const { data: existentes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
const porEmail = new Map((existentes?.users ?? []).map((u) => [u.email, u]));

const linhas = [];
for (const pessoa of pessoas ?? []) {
  const emailBase = `${slug(pessoa.nome)}@planhub.case`;
  let email = emailBase;
  let sufixo = 2;
  while (porEmail.has(email) && porEmail.get(email).user_metadata?.nome !== pessoa.nome) {
    email = `${slug(pessoa.nome)}.${sufixo}@planhub.case`;
    sufixo += 1;
  }

  let user = porEmail.get(email);
  let senhaGerada = null;
  if (!user) {
    senhaGerada = senha();
    const { data: criado, error } = await admin.auth.admin.createUser({
      email,
      password: senhaGerada,
      email_confirm: true,
      user_metadata: { nome: pessoa.nome },
    });
    if (error || !criado?.user) {
      console.error(`Falha ao criar ${email}: ${error?.message}`);
      continue;
    }
    user = criado.user;
  }

  const contagem = squadDoPessoa.get(pessoa.id);
  let squadId = null;
  if (contagem) {
    squadId = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  await admin.from("usuario").upsert({
    id: user.id,
    nome: pessoa.nome,
    email,
    papel: "operador",
    ativo: true,
    squad_id: squadId,
  });
  await admin.from("pessoas").update({ usuario_id: user.id }).eq("id", pessoa.id);

  linhas.push({ nome: pessoa.nome, email, senha: senhaGerada, squad: squads?.find((s) => s.id === squadId)?.nome ?? "—" });
}

const bloco = `## Operadores por squad

| Responsável | E-mail | Senha | Squad |
| :--- | :--- | :--- | :--- |
${linhas.map((l) => `| ${l.nome} | ${l.email} | ${l.senha ?? "(usuário já existia)"} | ${l.squad} |`).join("\n")}

_Gerado por scripts/criar-usuarios-squad.mjs em ${new Date().toISOString()}_`;

// Mantém todas as credenciais num único arquivo: substitui o bloco entre os
// marcadores, ou acrescenta ao final se ainda não existir.
const alvo = path.join(raiz, ".credenciais-avaliador.md");
const marcadorIni = "<!-- OPERADORES -->";
const marcadorFim = "<!-- /OPERADORES -->";
let atual = readFileSync(alvo, "utf8");
const ini = atual.indexOf(marcadorIni);
const fim = atual.indexOf(marcadorFim);
if (ini >= 0 && fim > ini) {
  atual = atual.slice(0, ini) + marcadorIni + "\n" + bloco + "\n" + atual.slice(fim);
} else {
  atual = `${atual}\n${marcadorIni}\n${bloco}\n${marcadorFim}\n`;
}
writeFileSync(alvo, atual, "utf8");
console.log(`${linhas.length} operador(es) criados/vinculados. Senhas em .credenciais-avaliador.md`);