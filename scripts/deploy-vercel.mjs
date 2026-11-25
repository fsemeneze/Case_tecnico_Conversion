// Deploy de produção na Vercel via API (mesma REST usada pelo MCP/CLI).
//
//   node scripts/deploy-vercel.mjs
//
// Variáveis de ambiente (fornecidas pelo cartão secreto, nunca gravadas):
//   VERCEL_TOKEN              — token da conta Vercel
//   SUPABASE_SERVICE_ROLE_KEY — service key do projeto do case
//
// Envia SOMENTE o que o build do Next precisa: fontes do app, configs,
// lib e métricas. Os CSVs grandes ficam no repositório, não no deploy.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEAM_ID = "team_RXaKBn4Am8MmCGEFUNzcAmZp";
const PROJETO = "conversion-case-entregas";

const arquivos = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "proxy.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/globals.css",
  "app/icones.tsx",
  "app/tema-toggle.tsx",
  "app/login/page.tsx",
  "app/login/layout.tsx",
  "app/login/esqueci-senha/page.tsx",
  "app/login/nova-senha/page.tsx",
  "app/sobre/page.tsx",
  "app/(app)/layout.tsx",
  "app/(app)/loading.tsx",
  "app/(app)/error.tsx",
  "app/(app)/sair-do-app.tsx",
  "app/(app)/item-menu.tsx",
  "app/(app)/conta/page.tsx",
  "app/(app)/conta/seguranca.tsx",
  "app/(app)/inicio/page.tsx",
  "app/(app)/clientes/page.tsx",
  "app/(app)/clientes/actions.ts",
  "app/(app)/revisao/page.tsx",
  "app/(app)/revisao/actions.ts",
  "app/(app)/revisao/botao-resolver.tsx",
  "app/(app)/equipe/page.tsx",
  "app/(app)/equipe/actions.ts",
  "app/(app)/equipe/convidar.tsx",
  "app/(app)/equipe/controles-usuario.tsx",
  "app/(app)/entregas/page.tsx",
  "app/(app)/entregas/nova/page.tsx",
  "app/(app)/entregas/nova/formulario.tsx",
  "app/(app)/entregas/[id]/page.tsx",
  "app/(app)/entregas/actions.ts",
  "app/aprovacao/[token]/page.tsx",
  "app/aprovacao/[token]/formulario-aprovacao.tsx",
  "app/cliente/[token]/page.tsx",
  "lib/supabase/servidor.ts",
  "lib/supabase/navegador.ts",
  "lib/supabase/admin.ts",
  "lib/fases.ts",
  "lib/validacao.ts",
  "lib/consultas.ts",
  "analysis/out/metricas.json",
  "scripts/preparar-docs.mjs",
];

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Defina VERCEL_TOKEN.");
  process.exit(1);
}

const chamada = async (caminho, corpo) => {
  const r = await fetch(`https://api.vercel.com${caminho}${caminho.includes("?") ? "&" : "?"}teamId=${TEAM_ID}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto.length < 4000 ? texto : texto.slice(0, 4000) };
};

// 1. Service role key do Supabase (production + preview)
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceKey) {
  const env = await chamada(
    `/v10/projects/${PROJETO}/env?upsert=true`,
    {
      key: "SUPABASE_SERVICE_ROLE_KEY",
      value: serviceKey,
      type: "encrypted",
      target: ["production", "preview"],
    },
  );
  console.log(`env SUPABASE_SERVICE_ROLE_KEY: HTTP ${env.status}`);
  if (env.status >= 400) {
    console.error(env.corpo);
    process.exit(1);
  }
} else {
  console.log("aviso: SUPABASE_SERVICE_ROLE_KEY não fornecida — as páginas de aprovação não vão funcionar.");
}

// 2. Deployment de produção com os arquivos embutidos
const files = arquivos.map((arquivo) => ({
  file: `/${arquivo.replace(/\\/g, "/")}`,
  data: readFileSync(path.join(raiz, arquivo)).toString("base64"),
  encoding: "base64",
}));

const deploy = await chamada("/v13/deployments", {
  name: PROJETO,
  project: PROJETO,
  target: "production",
  files,
  projectSettings: { framework: "nextjs" },
  meta: { caseCase: "conversion-entregas" },
});

console.log(`deployment: HTTP ${deploy.status}`);
if (deploy.status >= 400) {
  console.error(deploy.corpo);
  process.exit(1);
}

const resultado = JSON.parse(deploy.corpo);
console.log(`url: https://${resultado.url}`);
console.log(`id: ${resultado.id}`);

// 3. Aponta o alias de produção para o novo deployment.
//    Com domínio customizado, o alias NÃO segue o deploy sozinho: sem este
//    passo, planops-co.vercel.app continua servindo a versão anterior.
const ALIAS = "planops-co.vercel.app";
const alias = await chamada(`/v1/deployments/${resultado.id}/aliases`, {
  alias: ALIAS,
});
console.log(`alias ${ALIAS}: HTTP ${alias.status}`);
if (alias.status >= 400) {
  console.error(alias.corpo);
  process.exit(1);
}
