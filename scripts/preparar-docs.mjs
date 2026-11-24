// Copia os artefatos do diagnóstico (gerados por analysis/diagnostico.py)
// para public/, tornando-os acessíveis no app e no deploy.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arquivos = [
  ["docs/diagnostico.md", "public/diagnostico.md"],
  ["docs/decisoes.md", "public/decisoes.md"],
  ["analysis/out/entregas_normalizadas.csv", "public/entregas_normalizadas.csv"],
  ["analysis/out/erros_qualidade.csv", "public/erros_qualidade.csv"],
];

mkdirSync("public", { recursive: true });

for (const [origem, destino] of arquivos) {
  try {
    mkdirSync(dirname(destino), { recursive: true });
    copyFileSync(origem, destino);
    console.log(`ok  ${origem} -> ${destino}`);
  } catch {
    console.warn(`aviso: ${origem} ainda não existe (rode o diagnóstico)`);
  }
}
