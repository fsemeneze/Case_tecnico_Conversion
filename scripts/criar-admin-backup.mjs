// Cria uma segunda conta de administrador (admin2@planhub.case).
// Requer .env.local com URL e SUPABASE_SERVICE_ROLE_KEY.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = "admin2@planhub.case";
const senha = `${randomBytes(9).toString("base64url")}A1!`;

const { data: existente } = await admin
  .from("usuario")
  .select("id")
  .eq("email", email)
  .maybeSingle();
if (existente) {
  console.log(JSON.stringify({ email, senha: "(já existe — redefina pela tela)" }));
  process.exit(0);
}

const { data: criado, error } = await admin.auth.admin.createUser({
  email,
  password: senha,
  email_confirm: true,
  user_metadata: { nome: "Admin de Backup" },
});
if (error) {
  console.error("erro:", error.message);
  process.exit(1);
}

await admin.from("usuario").upsert({
  id: criado.user.id,
  nome: "Admin de Backup",
  email,
  papel: "admin",
  ativo: true,
});

console.log(JSON.stringify({ email, senha }));