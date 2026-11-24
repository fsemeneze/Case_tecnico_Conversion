# Plano de ação: case técnico Analista de BI (AI Builder)

Case da Conversion para a vaga de Analista de BI Pleno (AI Builder). Objetivo: tirar o controle de entregas de uma planilha e transformá-lo em um app, com diagnóstico dos dados, modelagem, fatia funcional e README de produto.

- **Prazo:** 5 dias corridos a partir do recebimento do case.
- **Esforço estimado pela Conversion:** cerca de 6 horas.
- **Stack:** Supabase (Postgres, Auth, RLS), Next.js, Vercel (Hobby), GitHub.
- **Regra de ouro:** se algo ficar de fora, explicar o corte e o motivo no README.

---

## Visão geral das fases

| Fase | Nome | Duração estimada | Saída |
|---|---|---|---|
| 0 | Preparação e setup | 0,5 h | Repositório, projetos e ambiente prontos |
| 1 | Diagnóstico dos dados (E1) | 1 h | Relatório de achados e script de limpeza |
| 2 | Modelagem em Postgres (E2) | 1,5 h | Schema, RLS, migrations e importação |
| 3 | Fatia funcional do app (E3) | 2,5 h | Lista, cadastro, aprovação do cliente, histórico, atraso |
| 4 | README de produto (E4) | 1 h | README com migração, mudanças, escopo, próxima entrega e uso de IA |
| 5 | Diferenciais | Distribuído nas fases anteriores | Itens que diferenciam o candidato |
| 6 | Publicação, acessos e vídeo | 1 h | Deploy, usuários de teste, vídeo de 5 a 10 min |
| 7 | Revisão e envio | 0,5 h | Pacote enviado ao People |

---

## Fase 0: preparação e setup

**Objetivo:** ter o ambiente pronto antes de escrever código de negócio.

Tarefas:

1. Criar um projeto no Supabase (plano Free) **exclusivo para o case**. Nunca usar credenciais pessoais ou de outros projetos.
2. Criar o repositório no GitHub (privado, com convite aos avaliadores ou público).
3. Criar o projeto Next.js e conectar à Vercel (plano Hobby).
4. Definir o uso das ferramentas de IA: escolher uma ferramenta principal (Codex, Copilot Free, Antigravity CLI ou OpenCode) e registrar isso para o README.
5. Criar o arquivo `.env.example` com as variáveis necessárias, sem valores reais.
6. Criar um `.gitignore` que proíba versionar `.env`.
7. Criar a pasta `docs/` com `decisoes.md` para registrar decisões e premissas durante o trabalho.

Critério de pronto: `npm run dev` roda uma página vazia localmente e o deploy inicial responde na Vercel.

---

## Fase 1: diagnóstico dos dados (E1)

**Objetivo:** entender o processo pelos dados e registrar o que está errado na planilha, com números.

### 1.1 Perfil da base

- 1.007 linhas (o case diz "cerca de 1.000").
- 32 grafias de cliente, que representam cerca de 25 clientes reais.
- 3 squads (Azul, Verde, Laranja) e 10 responsáveis.
- Período nominal nov/2025 a out/2026, com datas até nov/2026, fora da janela declarada.

### 1.2 Achados principais

| Achado | Evidência | Impacto |
|---|---|---|
| Linhas duplicadas | 12 IDs aparecem duas vezes (81, 303, 386, 430, 522, 525, 537, 615, 750, 786, 811, 866) | Contagens e métricas erradas |
| Registros fantasmas | IDs 986 a 995 replicam entregas existentes com outro ID (ex.: 991 = 706, 986 = 73, 993 = 108) | Duplicação silenciosa |
| Links repetidos | 21 links aparecem em mais de uma linha | Rastreabilidade quebrada |
| Cliente com grafias diferentes | Loja Alfa, TechNova e Grupo Vértice Saúde com 3 a 4 grafias cada | Agregações por cliente erradas |
| Tipo com 11 grafias | "Relatorio", "Relatório mensal", "conteúdo blog", "Artigo", "Analise técnica" etc. | Impossível filtrar com confiança |
| Tipo e subtipo misturados | Auditoria e Análise técnica trazem o subtipo no título (Core Web Vitals, backlinks, indexação) | Falta a dimensão de subtipo |
| Status com mais de 20 grafias | Mistura fase (fazendo, em produção), aprovação (aprovado pelo cliente) e entrega (entregue, finalizado). "ok" é ambíguo | Não dá para responder "o que está parado e por quê" |
| Aprovações ambíguas | Sim, S, sim, ok, "aprovado c/ ressalvas", N/A, "não se aplica" e vazio | Não se sabe se vazio é "não aplicável" ou "não preenchido" |
| Revisões com erro | 99, -1, "duas", "2x", "1 ou 2" | Campo numérico inutilizável sem limpeza |
| Datas em 4 formatos | dd/mm/aaaa, ISO, serial do Excel (ex.: 45971), texto ("10/nov") | Cálculo de atraso impossível sem normalização |
| Datas vazias | 47 previstas vazias e 74 de entrega vazias | Atraso não calculável para parte da base |
| Atraso | 259 de 833 entregas comparáveis entregues após o prazo: **31%** | Dor 1 do case, medida hoje à mão |
| Estados inconsistentes | 13 concluídas sem data de entrega; cancelamentos com status "Em produção"; responsável "Bruno (saiu)" com entregas abertas | Estado da entrega não é confiável |

### 1.3 Regras de limpeza e premissas

Para cada problema, uma regra e uma premissa registrada. Exemplos:

- Vazio em aprovação de relatório = "não se aplica", porque relatórios não parecem ter etapa de planejamento.
- "ok" em status = entregue. Em aprovação = aprovado.
- Linhas com data em nov/2026 = mantidas com sinalização de fora da janela.
- Duplicados e fantasmas = não apagados, enviados para revisão.

### 1.4 Mapeamento de status

Cada valor antigo vai para um campo de fase e outro de aprovação. Tabela a ser completa no script de limpeza.

### 1.5 Entregáveis da fase

- Seção "Diagnóstico" no README (ou notebook ou PDF curto).
- Script de limpeza versionado no repositório (Python ou SQL).
- Tabela de achados e tabela de regras.

Critério de pronto: qualquer pessoa roda o script e reproduz os números 31%, 12 duplicados e 21 links repetidos.

---

## Fase 2: modelagem em Postgres (E2)

**Objetivo:** um schema que resolve as três dores (atraso, rastreabilidade, visibilidade do cliente).

### 2.1 Tabelas

- **`clientes`:** nome canônico. Apelidos (grafias originais) em tabela própria.
- **`pessoas`:** responsáveis, com squad e status ativo/inativo.
- **`squads`:** Azul, Verde, Laranja.
- **`entregas`:** tipo (Relatório, Análise, Conteúdo), subtipo (Auditoria técnica, Core Web Vitals, backlinks, indexação, concorrência, mapeamento de conteúdo, palavras-chave, Artigo), título, cliente, squad, responsável, datas (solicitação, prevista, entrega), fase, aprovação de planejamento, aprovação de entrega, `num_revisoes` com `CHECK (num_revisoes >= 0)`, link, `legacy_id` e observações.
- **`eventos`:** histórico de mudanças (de, para, ator, data), preenchido por trigger.
- **`aprovacoes`:** decisão do cliente por etapa (planejamento ou entrega), com comentário e data.
- **`importacao_legado`:** linha original em JSON, para auditoria da migração.
- **`erros_importacao`:** linhas que não passaram nas regras, para revisão.

### 2.2 Decisão central: separar fase de aprovação

Fases: `solicitada` → `em_producao` → `aguardando_planejamento` → `planejamento_aprovado` → `entregue` → `aguardando_aprovacao_entrega` → `aprovada`.
Desvios: `ajuste_solicitado` e `cancelada`.

Aprovações (campos separados): `pendente`, `aprovada`, `aprovada_com_ressalvas`, `nao_aplica`.

Transições inválidas são bloqueadas no banco (função ou trigger), não só na interface.

### 2.3 Segurança

- RLS habilitado em todas as tabelas.
- Equipe autenticada lê e escreve. Anônimo não lê nada.
- Cliente não tem login. A aprovação é feita por link com token único por entrega, via função `SECURITY DEFINER` que aceita apenas a ação permitida para aquela entrega e expõe só aquela entrega.
- Testes de RLS: usuário sem permissão não lê a tabela; token não lê outra entrega; cancelada não aceita aprovação.

### 2.4 Importação

- Script de limpeza da Fase 1 carrega o CSV.
- Regras aplicadas; erros gravados em `erros_importacao`.
- Nenhuma linha descartada em silêncio.
- Contagem final conferida: linhas de entrada = linhas importadas + linhas em revisão.

### 2.5 Migrations

Tudo em arquivos de migration versionados (uma por etapa: schema, RLS, triggers, importação). Nada feito só pelo painel do Supabase.

Critério de pronto: banco populado, testes de RLS passando e a contagem de importação batendo.

---

## Fase 3: fatia funcional do app (E3)

**Objetivo:** um app que a equipe usa de verdade e que o cliente consegue aprovar.

### 3.1 Prioridades

| Prioridade | Funcionalidade | Critério de pronto |
|---|---|---|
| P0 | Lista de entregas com filtros (cliente, tipo, squad, responsável, fase, atrasada) e busca por título | Filtros combinados funcionam; busca sem acento e sem diferença de caixa |
| P0 | Cadastro e edição de entrega | Validação de datas e tipos; campos obrigatórios; status restritos a valores válidos |
| P0 | Aprovação em duas etapas pelo cliente (planejamento e entrega) | Cliente aprova pelo link; a fase avança sozinha; registro fica salvo |
| P1 | Histórico por entrega (linha do tempo) | Cada mudança aparece com ator e data |
| P1 | Indicador de atraso e cartão "em atraso agora" | Número bate com a consulta SQL do diagnóstico |
| P2 | Login da equipe com allowlist de e-mails | Somente e-mails autorizados entram |
| P2 | Exportação CSV da lista filtrada | Respeita os filtros aplicados |

Se o tempo acabar, cortar de baixo para cima (P2 primeiro) e explicar no README.

### 3.2 Regras de negócio a implementar

- Atraso = data de entrega posterior à prevista, ou entrega em aberto com prazo já vencido.
- Cancelada não aceita aprovação.
- Aprovação do cliente só é possível na fase correta (planejamento antes de produção; entrega depois de entregue).
- Ajuste solicitado volta a `em_producao` e incrementa `num_revisoes`.

### 3.3 Estados de tela

Cada tela com estado de carregamento, vazio e erro. Não é preciso design sofisticado; é preciso o tratamento de erro.

Critério de pronto: fluxo completo testado de ponta a ponta, do cadastro à aprovação final, com um cliente de teste.

---

## Fase 4: README de produto (E4)

Até 1 página. Estrutura:

1. **O que migrou igual da planilha:** campos, tipos de entrega e dados históricos (com contagem).
2. **O que mudou e por quê:** separação de fase e aprovação; subtipo; histórico; cliente canônico; datas normalizadas. Cada mudança com a evidência do diagnóstico.
3. **O que ficou de fora:** notificação por e-mail, integração com Drive, relatórios de produtividade por pessoa. Motivo de cada corte.
4. **Próxima entrega e por quê:** alerta proativo de prazo (para a equipe e para o cliente). Ataca as dores 1 e 3 com custo baixo.
5. **Como usei IA:** ferramentas, para quê, e pelo menos um caso em que a IA errou e você corrigiu.
6. **Como rodar localmente:** variáveis de ambiente (de um projeto Supabase do case), comandos de migração e seed, comando de subida.
7. **Premissas:** dados fictícios com inconsistências intencionais; regras de limpeza da Fase 1.

Critério de pronto: um avaliador consegue rodar o projeto só com o README.

---

## Fase 5: diferenciais

Distribuídos nas fases anteriores. A maioria dos candidatos entrega lista e CRUD; estes itens mostram senso de produto e engenharia.

1. **Diagnóstico com números e script reprodutível** (Fase 1).
2. **Definição explícita de atraso**, com a consulta SQL no README (Fase 3).
3. **Histórico automático por trigger**, sem depender de disciplina da equipe (Fase 2).
4. **Aprovação do cliente com registro** de quem aprovou, quando, com qual comentário, e o que aconteceu em seguida (Fase 2 e 3).
5. **Tratamento honesto de dados ruins**: fila de revisão em vez de descarte silencioso (Fase 2).
6. **Decisões registradas com alternativas** em `docs/decisoes.md` (Fase 0 em diante).
7. **Uso de IA documentado de forma crítica**, com um caso de erro e correção (Fase 4).
8. **Testes de regra de negócio**, não só de tela (Fase 2 e 3).
9. **Vídeo que conta uma história**: começa pelo número que dói (31% de atraso) e termina com a próxima entrega (Fase 6).
10. **Próxima entrega bem justificada**, com o que não faria agora e por quê (Fase 4).

---

## Fase 6: publicação, acessos e vídeo

### 6.1 Publicação

- Deploy na Vercel com variáveis de ambiente configuradas no painel (nunca no código).
- Supabase Free ativo durante a avaliação: uma consulta por dia para evitar pausa após 1 semana sem uso.

### 6.2 Usuários de teste

- Um usuário de equipe (perfil interno).
- Um link de aprovação de cliente de teste para cada etapa (planejamento e entrega).
- Documentar credenciais de teste no envio, separadas do repositório.

### 6.3 Vídeo de 5 a 10 minutos

| Trecho | Duração | Conteúdo |
|---|---|---|
| Problema | 1 min | Dores do case, com o número de atraso |
| Diagnóstico | 2 min | Principais achados e regras de limpeza |
| Demo | 4 min | Lista e filtros; cadastro; aprovação do cliente; histórico |
| Decisões e próximos passos | 2 min | Decisões-chave, o que ficou de fora e a próxima entrega |

---

## Fase 7: revisão e envio

Checklist antes de enviar:

- [ ] Repositório com código, migrations, queries e README.
- [ ] Nenhuma chave, senha ou `.env` versionado. Revisar o histórico do Git.
- [ ] Deploy respondendo; usuários de teste funcionando.
- [ ] README com as cinco seções obrigatórias do case (migração, mudanças, escopo, próxima entrega, uso de IA).
- [ ] Diagnóstico entregue (no README, notebook ou PDF).
- [ ] Vídeo publicado e com o link informado.
- [ ] Convites enviados a leonan.sacchi@conversion.com.br e nicolas.simionato@conversion.com.br.
- [ ] Envio para carla.prates@conversion.com.br com as instruções para rodar localmente.

Enviar com antecedência. Entregar dentro do prazo, com algo bem feito e bem explicado, vale mais do que entregar tudo com bugs.

---

## Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Supabase pausado na avaliação | Consulta diária de manutenção; registrar no README |
| Cota da ferramenta de IA acabar | Terminar parte à mão; o case aceita isso |
| Estouro de tempo na fatia do app | Cortar P2 primeiro; explicar o corte |
| Vazamento pelo link de aprovação | Token único por entrega, com expiração; expõe só a própria entrega |
| Chave de produção no repositório | Chaves só do projeto do case; variáveis de ambiente fora do código |

---

## Premissas a registrar no README

- Dados fictícios, com inconsistências intencionais, tratadas como sujeira real.
- "ok" em status = entregue; em aprovação = aprovado.
- Vazio em aprovação de relatório = "não se aplica".
- Linhas com datas em nov/2026 estão fora da janela declarada (nov/2025 a out/2026) e foram mantidas com sinalização.
- Duplicados e fantasmas não são apagados; ficam na fila de revisão.

---

## Cronograma resumido

| Dia | Fases | Saída |
|---|---|---|
| 1 | 0 e 1 | Setup pronto; script de limpeza e tabela de achados |
| 2 | 2 | Banco populado; RLS e testes passando |
| 3 | 3 (P0 lista e cadastro) | App rodando local e no deploy |
| 4 | 3 (aprovação, histórico, atraso) e 5 | Fluxo completo testado |
| 5 | 4, 6 e 7 | README, vídeo, revisão e envio |
