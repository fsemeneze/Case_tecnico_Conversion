# Decisões e premissas

Registro das decisões tomadas durante o case, com o motivo e a alternativa
descartada. Serve para o avaliador entender o raciocínio, não só o resultado.

## D1. Stack

**Decisão:** Supabase (Postgres + Auth + RLS), Next.js (App Router) e Vercel.

**Por quê:** é a stack sugerida no case e cobre o que a vaga pede (Postgres/Supabase,
migrations, RLS, deploy). Tudo no plano gratuito.

**Alternativa descartada:** SQLite + deploy estático. Mais simples, mas não exercita
RLS, Auth nem o fluxo de ambientes que a vaga valoriza.

## D2. Separar fase de aprovação

**Decisão:** o campo `status` da planilha vira duas dimensões:
`fase` (andamento) e `aprovacao_planejamento` / `aprovacao_entrega` (decisão do cliente).

**Por quê:** a base mistura "Em produção", "Aguardando cliente" e "aprovado pelo cliente"
no mesmo campo. Sem separar, não dá para responder "o que está parado e por quê".

**Fases:** `solicitada`, `em_producao`, `aguardando_cliente`, `aguardando_aprovacao_entrega`,
`ajuste_solicitado`, `entregue`, `aprovada`, `cancelada`.

**Alternativa descartada:** manter um enum único com todos os valores antigos. Preserva
a planilha, mas perpetua a ambiguidade.

## D3. Cliente aprova por link com token, sem login

**Decisão:** o cliente não tem conta. Recebe um link com token único por entrega e por
etapa, que só permite aprovar/recusar aquela entrega.

**Por quê:** a dor é "o cliente pergunta por e-mail". Criar login para 25 clientes
aumenta atrito e superfície de segurança. O token resolve com uma função `SECURITY DEFINER`
que expõe somente a entrega do token.

**Cuidados:** token com expiração, uso único por etapa, registro de autor (nome/e-mail
informado na hora), e nada além da entrega é retornado.

## D4. Não apagar duplicados: fila de revisão

**Decisão:** IDs repetidos e registros com assinatura idêntica são importados e marcados
com `flags`, e aparecem em `erros_qualidade.csv` e na `importacao_legado`.

**Por quê:** 12 IDs aparecem duas vezes e os IDs 986 a 995 replicam entregas existentes
com outro número. Apagar exige decisão humana; importar em silêncio esconde o problema.
A importação preserva a linha original em JSON para auditoria.

## D5. Normalização de datas

**Decisão:** aceitar quatro formatos (dd/mm/aaaa, ISO, serial do Excel, "dd/mês"),
normalizar para `DATE` e registrar a observação. Quando o texto não tem ano, inferir
o ano pela data mais próxima da solicitação.

**Por quê:** 1.007 linhas com 887 em dd/mm/aaaa, 26 em ISO, 37 em serial e 41 em texto
curto. Sem normalizar, 30% da base não entra em cálculo de atraso.

**Limite:** a inferência de ano é uma premissa; linhas afetadas ficam sinalizadas com
`data_*_texto_ano_inferido` para conferência.

## D6. Aprovação vazia em relatório = não se aplica

**Decisão:** em `tipo = Relatório`, aprovação de planejamento vazia vira `nao_aplica`.
Nos outros tipos, vazio vira `nao_informado`.

**Por quê:** relatórios mensais não têm etapa de planejamento na operação descrita; os
demais vazios podem ser falta de preenchimento. Separar os dois evita métrica falsa.

## D7. "ok"/"aprovado" sem aprovação explícita = entregue

**Decisão:** se o status diz "aprovado"/"ok"/"finalizado" mas a coluna de aprovação de
entrega não confirma, a entrega fica `entregue` e recebe a flag
`status_aprovado_sem_aprovacao`.

**Por quê:** "ok" é usado para as duas coisas na planilha. A coluna de aprovação é a
evidência mais forte. O contrário (aprovação registrada mas status anterior) também é
sinalizado, sem sobrescrever o status declarado.

## D8. Definição de atraso

**Decisão:**
- Entrega concluída: `data_entrega > data_prevista`.
- Em aberto: `data_prevista < hoje` e fase não final nem cancelada.
- Não comparável quando falta uma das datas.

**Por quê:** é a única definição que a base permite calcular e que responde à dor 1.
Fica registrada para que o número do app bata com o do diagnóstico.

## D9. Subtipo derivado do título

**Decisão:** o tipo é normalizado para Relatório, Análise ou Conteúdo; o subtipo de
Análise é extraído do título (Core Web Vitals, Backlinks, Indexação, Concorrência,
Mapeamento de conteúdo, Palavras-chave, Auditoria técnica).

**Por quê:** a planilha usa "Análise técnica" e "Auditoria" como tipos, mas o título é
quem diz o que foi feito. Sem subtipo, 248 análises viram uma caixa única.

## D10. Segredos e ambientes

**Decisão:** um projeto Supabase só para o case. `.env.example` no repositório, `.env*`
no `.gitignore`. Nenhuma credencial pessoal.

**Por quê:** exigência explícita do case e boa prática. O histórico do Git será revisado
antes do envio.

## Premissas

1. Os dados são fictícios, mas as inconsistências são tratadas como sujeira real.
2. Datas em nov/2026 estão fora da janela declarada (nov/2025 a out/2026) e ficam
   mantidas com sinalização.
3. "Em andamento" e "fazendo" equivalem a `em_producao`.
4. "Com o cliente" e "Entrega em aprovação" equivalem a `aguardando_aprovacao_entrega`.
5. O valor 99 em `num_revisoes` é erro de digitação (não 99 revisões) e vira nulo com flag.
6. Cancelamento no texto livre (`observacoes`) prevalece sobre status de produção.
7. A data de referência do diagnóstico é a data de execução do script.

## Pendências conhecidas

- Fase 2: schema, RLS e importação no Supabase.
- Fase 3: app (lista, cadastro, aprovação, histórico).
- Fase 4: README de produto (1 página).
- Definir identidade visual mínima; não é critério do case.
