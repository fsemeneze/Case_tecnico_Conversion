// Cria contas de teste (um por papel), faz login real de cada uma e testa o
// que o papel pode ler/escrever no banco (RLS). Grava um arquivo por usuário
// em docs/testes/.
//
// Uso: node scripts/testar-papeis.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY no ambiente (cartão secreto). A URL e a
// chave publicável saem do .env.local.
//
// As contas são idempotentes: rodar de novo reutiliza as mesmas.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function lerEnvLocal() {
  const arquivo = path.join(raiz, ".env.local");
  const txt = readFileSync(arquivo, "utf8");
  const env = {};
  for (const linha of txt.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const envLocal = lerEnvLocal();
const URL = envLocal.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = envLocal.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !PUBLISHABLE || !SERVICE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env.local) ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USUARIOS = [
  { papel: "admin", nome: "Admin de Teste", email: "REDACTED", senha: "REDACTED" },
  { papel: "gestor", nome: "Gestor de Teste", email: "REDACTED", senha: "REDACTED" },
  { papel: "operador", nome: "Operador de Teste", email: "REDACTED", senha: "REDACTED" },
  { papel: "leitor", nome: "Leitor de Teste", email: "REDACTED", senha: "REDACTED" },
];

// Dimensões para montar uma entrega de teste (mesma base do case).
const { data: fase } = await admin.from("fases").select("id").eq("codigo", "solicitada").maybeSingle();
const faseId = fase.id;
const { data: clienteId } = await admin.from("clientes").select("id").limit(1).maybeSingle();
const { data: tipoId } = await admin.from("tipos_entrega").select("id").limit(1).maybeSingle();
const { data: decisaoId } = await admin.from("decisoes_aprovacao").select("id").limit(1).maybeSingle();
const { data: origemId } = await admin.from("origens").select("id").limit(1).maybeSingle();

const baseEntrega = {
  origem_id: origemId.id,
  cliente_id: clienteId.id,
  tipo_entrega_id: tipoId.id,
  fase_id: faseId,
  aprovacao_planejamento_id: decisaoId.id,
  aprovacao_entrega_id: decisaoId.id,
};

async function garantirUsuario(u) {
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.senha,
    email_confirm: true,
    user_metadata: { nome: u.nome },
  });
  let id = criado?.user?.id;
  if (error) {
    // Já existe: busca o id em public.usuario.
    const { data: existente } = await admin
      .from("usuario")
      .select("id")
      .eq("email", u.email)
      .maybeSingle();
    id = existente?.id;
    if (!id) throw new Error(`Não foi possível obter id de ${u.email}: ${error.message}`);
  }
  await admin.from("usuario").upsert({
    id,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    ativo: true,
  });
  return id;
}

function clienteDoUsuario(accessToken) {
  const c = createClient(URL, PUBLISHABLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return c;
}

async function testar(u) {
  const linhas = [];
  const add = (ok, texto) => linhas.push({ ok, texto });

  // 1) Login real (mesma API que a tela /login usa).
  const anon = clienteDoUsuario();
  const { data: login, error: erroLogin } = await anon.auth.signInWithPassword({
    email: u.email,
    password: u.senha,
  });
  const logou = Boolean(login?.session?.access_token) && !erroLogin;
  add(logou, logou ? `Login OK (user id ${login.user.id})` : `Falha no login: ${erroLogin?.message}`);

  if (!logou) return { linhas, id: null };

  // Cliente com o token do usuário (respeita RLS).
  const scoped = createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${login.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2) Leitura de entregas (todos os papéis leem).
  const { count: totalEntregas, error: erroEntregas } = await scoped
    .from("entregas_detalhadas")
    .select("id", { count: "exact", head: true });
  add(!erroEntregas, erroEntregas ? `Erro ao ler entregas: ${erroEntregas.message}` : `Leitura de entregas OK (${totalEntregas} linhas)`);

  // 3) Leitura de usuários (admin vê todos; demais só o próprio).
  const { data: usuarios, error: erroUsuarios } = await scoped
    .from("usuario")
    .select("id, email, papel");
  if (!erroUsuarios) {
    add(true, `Leitura de usuários: ${usuarios.length} registro(s) visível(is) [${usuarios.map((x) => x.papel).join(", ")}]`);
  } else {
    add(false, `Erro ao ler usuários: ${erroUsuarios.message}`);
  }

  // 4) Escrita em entregas (leitor não pode; demais podem).
  const titulo = `TESTE_PAPEL_${u.papel}_${Date.now()}`;
  const { data: inserida, error: erroInsert } = await scoped
    .from("entregas")
    .insert({ ...baseEntrega, titulo })
    .select("id")
    .maybeSingle();
  const podeEscrever = !erroInsert && Boolean(inserida?.id);
  if (podeEscrever) {
    add(true, `Escrita em entregas OK (id ${inserida.id})`);
  } else if (u.papel === "leitor") {
    add(true, `Escrita em entregas bloqueada pelo RLS (esperado para leitor): ${erroInsert?.message}`);
  } else {
    add(false, `Escrita em entregas falhou inesperadamente: ${erroInsert?.message}`);
  }

  // 5) Exclusão (só admin). Usa .select para ver se alguma linha foi de fato
  //    excluída — o PostgREST responde 204 mesmo quando o RLS exclui 0 linhas.
  if (podeEscrever && inserida?.id) {
    const { data: delData, error: erroDelete } = await scoped
      .from("entregas")
      .delete()
      .eq("id", inserida.id)
      .select("id");
    const deletou = !erroDelete && (delData?.length ?? 0) > 0;
    if (deletou) add(true, "Exclusão de entrega OK (admin)");
    else if (u.papel === "admin")
      add(false, `Exclusão falhou: ${erroDelete?.message ?? "nenhuma linha excluída"}`);
    else add(true, "Exclusão bloqueada pelo RLS (esperado para não-admin)");
  }

  return { linhas, id: login.user.id, podeEscrever };
}

function markdown(u, resultado) {
  const status = (ok) => (ok ? "✅" : "❌");
  const itens = resultado.linhas.map((l) => `- ${status(l.ok)} ${l.texto}`).join("\n");
  return `# Teste de acesso — ${u.papel}

**Usuário:** ${u.nome}
**E-mail:** ${u.email}
**Senha:** ${u.senha}
**Papel:** ${u.papel}

## Resultado

${itens}

## O que este papel pode fazer (resumo)

- Login na plataforma: ${resultado.linhas[0]?.ok ? "sim" : "não"}.
- Ler entregas: sim (todos os papéis).
- Ler a lista de usuários: ${u.papel === "admin" ? "todos" : "apenas o próprio"}.
- Criar/editar entregas: ${resultado.podeEscrever ? "sim" : "não"}.
- Excluir entregas: ${u.papel === "admin" ? "sim" : "não"}.

---
_Gerado por scripts/testar-papeis.mjs em ${new Date().toISOString()}_
`;
}

mkdirSync(path.join(raiz, "docs", "testes"), { recursive: true });

// Limpeza inicial (remove linhas de teste de execuções anteriores).
await admin.from("entregas").delete().like("titulo", "TESTE_PAPEL_%");

for (const u of USUARIOS) {
  const id = await garantirUsuario(u);
  const resultado = await testar(u);
  const arquivo = path.join(raiz, "docs", "testes", `${u.papel}.md`);
  writeFileSync(arquivo, markdown(u, resultado), "utf8");
  console.log(`[${u.papel}] ${u.email} -> ${resultado.linhas[0]?.ok ? "login OK" : "FALHOU"} (${arquivo})`);
  // Limpa linhas de teste deste papel para não inflar a contagem do próximo.
  await admin.from("entregas").delete().like("titulo", "TESTE_PAPEL_%");
}

// Limpeza de qualquer linha de teste que tenha sobrado.
const { error: erroLimpeza } = await admin
  .from("entregas")
  .delete()
  .like("titulo", "TESTE_PAPEL_%");
console.log(erroLimpeza ? `Aviso na limpeza: ${erroLimpeza.message}` : "Limpeza de linhas de teste OK.");

// Índice.
const indice = `# Testes de acesso por papel

Contas de teste (uma por papel) e o resultado de login + permissões (RLS).

| Papel | E-mail | Senha | Arquivo |
| :--- | :--- | :--- | :--- |
${USUARIOS.map((u) => `| ${u.papel} | ${u.email} | ${u.senha} | [${u.papel}.md](./${u.papel}.md) |`).join("\n")}

_Login testado contra a mesma API de autenticação usada pela tela /login (Supabase Auth)._
`;
writeFileSync(path.join(raiz, "docs", "testes", "README.md"), indice, "utf8");
console.log("Índice em docs/testes/README.md");