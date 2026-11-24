# Controle de entregas — Conversion

Case técnico para a vaga de **Analista de BI Pleno (AI Builder)** na Conversion.
O objetivo é tirar o controle de entregas de uma planilha e transformá-lo em um app,
passando por diagnóstico dos dados, modelagem e uma fatia funcional.

**Estado atual:** Fase 0 (estrutura do projeto) e Fase 1 (diagnóstico dos dados)
concluídas. Modelagem e app em andamento.

## Fases

| Fase | Entrega | Estado |
| :--- | :--- | :--- |
| 0 | Estrutura do projeto, stack, decisões e ambiente | Concluída |
| 1 | Diagnóstico dos dados e base normalizada | Concluída |
| 2 | Modelagem Postgres/Supabase, RLS e importação | Concluída |
| 3 | Fatia funcional do app | A fazer |
| 4 | README de produto (1 página) | A fazer |

## Diagnóstico em números

Base: `dados/controle_entregas.csv`, 1.007 linhas, nov/2025 a out/2026.

| Indicador | Valor |
| :--- | ---: |
| Clientes após normalização | 25 (eram 31 grafias) |
| Entregas com prazo e data de entrega | 888 |
| Entregas após o prazo | 273 (**30,7%**) |
| Mediana do atraso | 6 dias |
| Entregas abertas com prazo vencido hoje | 71 |
| IDs repetidos | 12 (24 linhas) |
| Linhas com assinatura idêntica (fantasmas) | 38 |
| Linhas em fila de revisão | 47 |

O relatório completo, gerado a partir da base, está em
[`docs/diagnostico.md`](docs/diagnostico.md). As decisões e premissas estão em
[`docs/decisoes.md`](docs/decisoes.md).

O diagnóstico responde às três dores do case:

1. **Atraso**: 30,7% das entregas comparáveis passaram do prazo; o app precisa calcular
   isso de `data_prevista` e `data_entrega` e tratar "em aberto com prazo vencido".
2. **Rastreabilidade**: 22 valores de status para o mesmo processo, misturando produção,
   espera e aprovação. A modelagem separa fase de aprovação e registra histórico.
3. **Visibilidade do cliente**: não havia status voltado ao cliente nem autoria de
   aprovação. O fluxo de aprovação por link resolve isso na Fase 3.

## Como rodar

Requisitos: Node.js 20.9+ (testado com Node 26 e Next 16) e Python 3.10+.

```bash
# 1. dependências
npm install

# 2. diagnóstico (gera docs/diagnostico.md e analysis/out/*)
npm run diagnostico

# 3. testes do normalizador
npm run test:diagnostico

# 4. app
npm run dev
```

O app abre em `http://localhost:3000`. Nesta fase ele apresenta o diagnóstico e o
estado do projeto; as telas de entregas entram na Fase 3.

### Banco de dados (Supabase)

As migrations versionadas em `supabase/migrations/` foram aplicadas no projeto
do case. Para reproduzir a base em outro projeto:

```bash
# aplica as migrations e importa a base normalizada
# (requer a senha do banco: DB_PASSWORD ou DATABASE_URL)
node scripts/importar-para-supabase.mjs
```

A conexão usa o pooler do Supabase (`*.pooler.supabase.com`, IPv4): o host
direto `db.<ref>.supabase.co` resolve apenas IPv6 e não conecta em redes
IPv4.

### Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com um projeto Supabase **criado
para este case**. Nunca use credenciais pessoais ou de outros projetos.
Nenhum arquivo `.env*` é versionado.

## Estrutura

```
app/                    App Next.js (App Router)
analysis/
  diagnostico.py        script de diagnóstico e normalização
  test_diagnostico.py   testes do normalizador
  out/                  saídas geradas: base normalizada, erros, métricas
supabase/
  migrations/           schema: tabelas, RLS, histórico e aprovação por token
docs/
  diagnostico.md        relatório gerado pelo script
  decisoes.md           decisões, premissas e alternativas descartadas
dados/                  base original do case
scripts/                cópia dos artefatos para public/ e importação no Supabase
```

### Saídas do diagnóstico

- `analysis/out/entregas_normalizadas.csv` — base limpa, pronta para importação.
- `analysis/out/erros_qualidade.csv` — um registro por problema, com severidade;
  é a fila de revisão antes de importar.
- `analysis/out/mapa_status.csv` — mapeamento status original → fase normalizada.
- `analysis/out/metricas.json` — números usados no app e no relatório.

## Decisões principais

- **Fase e aprovação são dimensões separadas.** `status` da planilha não responde
  "onde está a entrega"; a separação está descrita em [`docs/decisoes.md`](docs/decisoes.md).
- **Nada é apagado em silêncio.** Duplicados e inconsistências vão para a fila de
  revisão e a linha original é preservada para auditoria.
- **Cliente aprova por link com token**, sem login, expondo apenas a própria entrega.
- **Atraso tem uma definição única**, documentada, usada pelo diagnóstico e pelo app.

## Uso de IA

Ferramentas usadas até aqui, e para quê:

| Ferramenta | Uso |
| :--- | :--- |
| OpenCode (agente de código) | Estrutura do projeto, revisão do script de diagnóstico, geração de relatório e docs |
| Plugin `opencode-supabase` | Integração com Supabase (login, Management API) para a modelagem da Fase 2 |
| Scripts próprios (Python) | Normalização, métricas e testes; nenhuma decisão de negócio delegada |

O que foi revisado ou corrigido manualmente: a regra de inferência de ano das datas
abreviadas, o tratamento de revisões inválidas (`99`, `-1`, "duas") e a decisão de não
apagar duplicados. O teste `test_revisoes_outlier_e_negativo` encontrou um bug real no
normalizador (um `-1` virava `1`), corrigido antes de gerar a base final.

Este README será consolidado no README de produto (até 1 página) na Fase 4, com o que
migrou igual, o que mudou, o que ficou de fora e a próxima entrega.

## Premissas

- Dados fictícios, com inconsistências intencionais, tratadas como sujeira real.
- Datas em nov/2026 ficam fora da janela declarada e são mantidas com sinalização.
- "ok" em status sem aprovação registrada é tratado como entregue, com flag.
- Em relatório, aprovação de planejamento vazia é tratada como "não se aplica".
- A data de referência de "atraso hoje" é a data de execução do script.
