// Importa a base normalizada (Fase 1) para o Supabase do case.
//
//   node scripts/importar-para-supabase.mjs
//
// Variável de ambiente obrigatória:
//   DATABASE_URL — connection string do projeto do case
//     (Supabase Dashboard → Connect → URI).
//
// Fontes (geradas por analysis/diagnostico.py):
//   analysis/out/entregas_normalizadas.csv — 1.007 entregas
//   analysis/out/erros_qualidade.csv      — fila de revisão
//   dados/controle_entregas.csv           — linha original (auditoria)
//
// Regras (docs/decisoes.md):
//   - D4: nada é apagado — a linha original da planilha vai para
//     entregas.origem_linha (jsonb); os problemas vão para
//     erros_importacao, vinculados à entrega quando o legacy_id é único.
//   - A importação é o estado inicial: INSERT não dispara o trigger de
//     histórico, que registra apenas mudanças posteriores.
//   - Idempotente por guard: aborta se já houver importação (--force ignora).

import { Client } from "pg";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pastaRaiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (relativo) => readFileSync(path.join(pastaRaiz, relativo), "utf-8");
const csv = (relativo) =>
  parse(ler(relativo), { columns: true, skip_empty_lines: true });

const nulo = (v) => (v === "" || v === undefined ? null : v);

async function main() {
  // Conexão: aceita DATABASE_URL pronto, ou monta a URI do pooler a partir
  // da senha (DB_PASSWORD). O host direto db.<ref>.supabase.co resolve só
  // IPv6 — em redes sem IPv6, usa-se o pooler (IPv4).
  const ref = process.env.PROJECT_REF || "rdtsepnawyndkpbkqceg";
  const poolHost = process.env.POOL_HOST || "aws-1-us-west-2.pooler.supabase.com";
  const porta = process.env.POOL_PORT || "5432";
  const databaseUrl =
    process.env.DATABASE_URL ||
    (process.env.DB_PASSWORD
      ? `postgresql://postgres.${ref}:${encodeURIComponent(process.env.DB_PASSWORD)}@${poolHost}:${porta}/postgres`
      : null);
  if (!databaseUrl) {
    console.error(
      "Defina DATABASE_URL (URI completa) ou DB_PASSWORD (senha do banco do projeto do case).",
    );
    process.exit(1);
  }

  const forcar = process.argv.includes("--force");

  const brutas = csv("dados/controle_entregas.csv");
  const normalizadas = csv("analysis/out/entregas_normalizadas.csv");
  const erros = csv("analysis/out/erros_qualidade.csv");

  if (normalizadas.length !== brutas.length) {
    throw new Error(
      `Base inconsistente: ${normalizadas.length} normalizadas vs ${brutas.length} brutas.`,
    );
  }

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();

  try {
    const { rows: guard } = await cliente.query(
      "select count(*)::int as total from entregas where legacy_id is not null",
    );
    if (guard[0].total > 0 && !forcar) {
      console.error(
        `Já existem ${guard[0].total} entregas importadas. Use --force para importar de novo.`,
      );
      process.exit(1);
    }

    await cliente.query("begin");

    // 1. Clientes canônicos ------------------------------------------------
    const nomes = [...new Set(normalizadas.map((l) => l.cliente))].sort();
    for (const nome of nomes) {
      await cliente.query(
        "insert into clientes (nome) values ($1) on conflict (nome) do nothing",
        [nome],
      );
    }
    const { rows: mapa } = await cliente.query("select id, nome from clientes");
    const idCliente = Object.fromEntries(mapa.map((c) => [c.nome, c.id]));

    // 2. Entregas (INSERT em lotes; 18 parâmetros por linha) ---------------
    const idsPorIndice = [];
    const colunas = `(legacy_id, cliente_id, titulo, tipo, subtipo, squad, responsavel,
        data_solicitacao, data_prevista, data_entrega,
        fase, aprovacao_planejamento, aprovacao_entrega, num_revisoes,
        link, observacoes, flags, origem_linha)`;
    const casts = (base) =>
      [
        `$${base}::int`,
        `$${base + 1}::bigint`,
        `$${base + 2}`,
        `$${base + 3}`,
        `$${base + 4}`,
        `$${base + 5}`,
        `$${base + 6}`,
        `$${base + 7}::date`,
        `$${base + 8}::date`,
        `$${base + 9}::date`,
        `$${base + 10}::fase_entrega`,
        `$${base + 11}::status_aprovacao`,
        `$${base + 12}::status_aprovacao`,
        `$${base + 13}::smallint`,
        `$${base + 14}`,
        `$${base + 15}`,
        `$${base + 16}::text[]`,
        `$${base + 17}::jsonb`,
      ].join(", ");

    const lote = 100;
    for (let i = 0; i < normalizadas.length; i += lote) {
      const fatia = normalizadas.slice(i, i + lote);
      const valores = [];
      const params = [];
      fatia.forEach((linha, j) => {
        const base = j * 18 + 1;
        valores.push(`(${casts(base)})`);
        const flags = (linha.flags || "")
          .split("|")
          .map((f) => f.trim())
          .filter(Boolean);
        params.push(
          nulo(linha.legacy_id),
          idCliente[linha.cliente],
          linha.titulo,
          linha.tipo,
          nulo(linha.subtipo),
          nulo(linha.squad),
          nulo(linha.responsavel),
          nulo(linha.data_solicitacao),
          nulo(linha.data_prevista),
          nulo(linha.data_entrega),
          linha.status_normalizado,
          linha.aprovacao_planejamento,
          linha.aprovacao_entrega,
          nulo(linha.num_revisoes),
          nulo(linha.link),
          nulo(linha.observacoes),
          flags,
          JSON.stringify(brutas[i + j]),
        );
      });

      const { rows } = await cliente.query(
        `insert into entregas ${colunas} values ${valores.join(", ")} returning id`,
        params,
      );
      rows.forEach((r, j) => {
        idsPorIndice[i + j] = r.id;
      });
    }

    // 3. Fila de revisão ---------------------------------------------------
    // Vincula à entrega quando o legacy_id aparece uma única vez na base;
    // quando é um dos IDs duplicados, fica só o legacy_id (D4).
    const contagemLegacy = new Map();
    for (const l of normalizadas) {
      contagemLegacy.set(l.legacy_id, (contagemLegacy.get(l.legacy_id) || 0) + 1);
    }
    const entregaUnicaPorLegacy = new Map();
    normalizadas.forEach((l, i) => {
      if (contagemLegacy.get(l.legacy_id) === 1) {
        entregaUnicaPorLegacy.set(l.legacy_id, idsPorIndice[i]);
      }
    });

    let vinculados = 0;
    for (const erro of erros) {
      const entregaId = entregaUnicaPorLegacy.get(erro.id) ?? null;
      if (entregaId) vinculados++;
      await cliente.query(
        `insert into erros_importacao (entrega_id, legacy_id, codigo, severidade, detalhe)
         values ($1, $2, $3, $4::severidade_erro, $5)`,
        [entregaId, erro.id, erro.codigo, erro.severidade, erro.detalhe],
      );
    }

    await cliente.query("commit");

    console.log(`Clientes: ${nomes.length}`);
    console.log(`Entregas: ${idsPorIndice.length}`);
    console.log(
      `Erros de importação: ${erros.length} (${vinculados} vinculados, ${erros.length - vinculados} só por legacy_id)`,
    );
  } catch (erro) {
    await cliente.query("rollback");
    throw erro;
  } finally {
    await cliente.end();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
