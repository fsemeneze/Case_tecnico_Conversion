# PlanOps — plano de melhoria

Plano para levar o app de "case de entrevista" a um produto que funciona de verdade:
login como porta de entrada, usuários com papéis, banco em modelo estrela e
uma interface com padrões de produto.

Nome do produto: **PlanOps — Planejamento e entregas**.

---

## 1. Diagnóstico do estado atual

O que funciona hoje: fluxo de aprovação do cliente por token, histórico por
trigger, RLS ativo em todas as tabelas, pipeline de importação com fila de
revisão, 1.007 entregas no banco.

O que faz parecer amador, em ordem de gravidade:

| # | Problema | Impacto |
|---|---|---|
| 1 | **Cadastro aberto na tela de login.** Qualquer pessoa cria conta e lê todas as entregas. | Segurança: vazamento de dados de clientes. Crítico. |
| 2 | **RLS `using (true)` para qualquer autenticado.** Não existe conceito de papel. | Sem controle de acesso real. |
| 3 | **Sem tabela de usuário.** `auth.users` é usado direto, sem perfil, nome, papel nem ativação. | Não há quem administrar, nem "quem fez o quê" além de texto livre. |
| 4 | **Modelo plano.** `entregas` mistura fatos (prazo, revisões) com atributos (cliente, squad, responsável, tipo) como texto. | Consultas analíticas caras e frágeis; nenhuma dimensão reutilizável. |
| 5 | **Nome e entrada errados.** A raiz `/` é um diagnóstico do case; o login é uma rota escondida. | O primeiro contato não parece produto. |
| 6 | **Sem validação de servidor.** Erros viajam na query string (`?erro=`). Nenhum schema de validação. | Erros ruins de UX e de dados. |
| 7 | **Interface sem sistema.** Estilos globais, sem layout de app, sem navegação, sem estados de carregamento, vazio ou erro. | Aparência de protótipo. |
| 8 | **Sem testes além do normalizador.** Nada cobre as regras de negócio do app nem o fluxo público. | Cada mudança pode quebrar o que já funciona. |
| 9 | **Números da home e do app vêm de arquivos JSON**, não do banco. | Duas fontes da mesma verdade. |

---

## 2. Modelo de dados em estrela

### 2.1 Princípio

Tabelas **fato** guardam medidas e eventos, na granularidade declarada. Tabelas
**dimensão** guardam o contexto de descrição (quem, o quê, quando, em que
estado). Atributos repetidos saem da fato e viram dimensão.

### 2.2 Granularidades

| Fato | Grão (uma linha por…) | Medidas principais |
|---|---|---|
| `fato_entrega` | entrega (estado atual) | `dias_atraso`, `dias_ciclo`, `num_revisoes`, flags de qualidade |
| `fato_evento_entrega` | mudança de fase ou de aprovação | `dias_na_fase_anterior` |
| `fato_aprovacao` | decisão do cliente por etapa | `dias_ate_decisao` |

`fato_evento_entrega` substitui o `entrega_historico` de texto livre. Passa a ser
a base de qualquer análise de tempo por fase.

### 2.3 Dimensões

| Dimensão | Conteúdo | Observação |
|---|---|---|
| `dim_data` | calendário (ano, mês, semana, dia útil) | Permite análise por período sem `date_trunc` espalhado |
| `dim_cliente` | cliente canônico | Ligada à `ponte_cliente_alias` com as 31 grafias originais |
| `dim_pessoa` | responsável pela entrega (Ana, Bruno…) | Pode apontar para um `usuario`, quando a pessoa tem login |
| `dim_squad` | squad | Pequena, mas separada: squad muda com o tempo |
| `dim_tipo_entrega` | tipo e subtipo (Relatório, Análise → Core Web Vitals…) | Subtipo derivado do título, como na D9 |
| `dim_fase` | 8 fases, com grupo (aberta, final, cancelada) e ordem | Substitui o enum no código; a regra "em aberto" vira dado |
| `dim_status_aprovacao` | 6 decisões | Idem |
| `dim_etapa_aprovacao` | planejamento, entrega | |
| `dim_origem` | planilha, app, importação | Rastreabilidade de cada linha |

### 2.4 Usuários e permissões (fora da estrela, mas no mesmo esquema)

| Tabela | Papel |
|---|---|
| `usuario` | perfil ligado a `auth.users`: nome, e-mail, papel, ativo, criado_por |
| `papel` (enum ou dimensão) | `admin`, `gestor`, `operador`, `leitor` |
| `convite` | convite enviado por admin, com validade e uso único |

Papéis, em resumo:

- **admin:** gerencia usuários, clientes, papéis; vê tudo.
- **gestor:** cria e edita entregas, aprova internamente, gera links de aprovação.
- **operador:** cria e edita entregas e registra progresso; não gerencia usuários.
- **leitor:** só consulta.

Cadastro **só por convite**. A tela de login não tem "Criar conta".

### 2.5 Visões de leitura

- `vw_entregas`: junta `fato_entrega` com as dimensões, `security_invoker = true`.
  É a única fonte da lista e do detalhe.
- `vw_indicadores_mensais`: agregados por mês, squad e cliente, para o dashboard.

### 2.6 Migração

- Criar o modelo novo ao lado do atual, preencher com `INSERT … SELECT` a partir das tabelas atuais.
- Validar por contagem: 1.007 entregas, 25 clientes, 273 atrasadas, 71 abertas vencidas,
  mesmos números do diagnóstico. Qualquer divergência bloqueia a troca.
- Só depois remover as tabelas antigas, em migration própria e reversível.

---

## 3. Autenticação, acesso e segurança

1. **Desabilitar cadastro público** no Supabase Auth (Authentication → Sign In / Providers → desligar sign-ups). Confirmar pelo painel: o MCP não expõe essa configuração.
2. **Convites por admin**: tela de convites que chama a Admin API (`inviteUserByEmail`) e registra em `convite`.
3. **Primeiro admin**: seed manual, documentado no README.
4. **RLS por papel**: funções `papel_atual()` e `tem_papel(…)` (SECURITY INVOKER, com `search_path` fixado). Políticas por tabela, não `using (true)`.
5. **Credenciais de teste**: trocar a senha da conta `demo-case` e desativá-la ao final do case. Não manter credencial de teste em documento versionado.
6. **Segredos**: `SUPABASE_SERVICE_ROLE_KEY` só no servidor; verificação em CI de que nenhum `NEXT_PUBLIC_` carrega segredo.
7. **Rate limit** no login e na página pública de aprovação (o token já é de uso único; o limite evita enumeração).

---

## 4. Aplicação

### 4.1 Entrada e navegação

- `/` redireciona: sessão ativa → `/inicio`; sem sessão → `/login`.
- `/login` é a porta de entrada: e-mail, senha, "esqueci a senha". Sem cadastro.
- Diagnóstico do case sai da raiz e vai para `/sobre` (ou para o README), acessível sem login.
- Layout de app com barra lateral: **Início, Entregas, Clientes, Revisão de dados, Equipe** (admin). Menu do usuário com papel e sair.
- Rota pública `/aprovacao/[token]` fica fora do layout interno, com visual próprio e simples.

### 4.2 Telas

| Tela | Conteúdo |
|---|---|
| **Início** | Cartões: atrasadas, vencidas hoje, aguardando cliente, aprovações pendentes. Gráfico de atraso por squad e por mês (de `vw_indicadores_mensais`). Lista "precisa de atenção". |
| **Entregas** | Lista com busca (debounce), filtros que ficam na URL, ordenação por coluna, paginação por cursor, exportação CSV do resultado filtrado, ação de nova entrega. |
| **Entrega (novo/editar)** | Formulário com validação (Zod, no servidor e no cliente), campos de dimensão como select com busca, estados de salvamento e erro por campo. |
| **Entrega (detalhe)** | Cabeçalho com situação e fase. Abas: **Resumo**, **Aprovações** (as duas etapas, links ativos, revogar, reenviar), **Histórico** (linha do tempo a partir de `fato_evento_entrega`), **Dados da planilha** (origem, flags, linha original). |
| **Clientes** | Lista, edição do nome canônico, gestão de grafias (aliases), contagem de entregas. |
| **Revisão de dados** | Fila de `erros_importacao` com filtro por código e severidade, vínculo para a entrega, marcar como resolvido com nota. |
| **Equipe** (admin) | Usuários, papel, ativar/desativar, convidar. |
| **Aprovação pública** | Já existe; ganha expiração visível, texto de confirmação, e-mail de comprovante (opcional). |

### 4.3 Padrões de interface

- Um conjunto pequeno de componentes próprios: `Button`, `Input`, `Select`, `Badge`, `Card`, `Table`, `Field`, `EmptyState`, `Toast`, `Dialog`.
- Estados obrigatórios em cada tela: carregando (skeleton), vazio (com ação), erro (com tentativa), sem permissão.
- Feedback de ações com `useActionState` e toast, sem redirecionar com erro na URL.
- Datas sempre em `pt-BR`, com fuso de São Paulo; dinheiro e números com separador local.
- Acessibilidade: foco visível, rótulos em todos os campos, contraste AA no tema claro e escuro, navegação por teclado no menu e nas tabelas.
- Responsivo: a lista vira cartões abaixo de 720px.

### 4.4 Decisões técnicas

| Decisão | Escolha | Alternativa descartada e por quê |
|---|---|---|
| Estilo | Tailwind v4 + componentes próprios | CSS global cresce sem controle; biblioteca completa (shadcn inteiro) seria mais peso do que o case precisa |
| Validação | Zod em `lib/validacao` compartilhado | Validar só no cliente deixa dados ruins passarem |
| Tipos do banco | `generate_typescript_types` (MCP) em `lib/db/tipos.ts` | Tipos escritos à mão divergem do schema |
| Leitura | `lib/consultas/*.ts`, sempre via `vw_*` | Consulta espalhada nas páginas repete regras |
| Estado de formulário | Server Actions + `useActionState` | Fetch manual duplica o caminho de erro |
| Testes | Vitest (regras de fase, atraso D8, validação) e Playwright (login → criar → aprovar) | Só teste manual não sustenta mudanças |

---

## 5. Qualidade e entrega

- **Testes:** unidade para `fases` e `situacaoDaEntrega`; integração com o Supabase local (ou um schema de teste) para RLS: cada papel vê e altera só o que deve; e2e para os três fluxos principais.
- **CI (GitHub Actions):** typecheck, lint, testes unitários, build, teste de RLS. Bloqueia merge se falhar.
- **Pre-commit:** formatação e typecheck (skill `setup-pre-commit` já disponível).
- **Lint:** `eslint-config-next` está em versão 15 e o Next é 16. Atualizar para a versão compatível antes de ligar o lint no CI.
- **Números únicos:** home e indicadores lidos de `vw_indicadores_*` no banco. `metricas.json` fica como artefato do diagnóstico, não como fonte do app.
- **Observabilidade:** logs de erro com identificador de requisição; revisão de erros de runtime na Vercel após cada deploy.
- **Deploy:** repositório no GitHub conectado à Vercel; `main` vira produção, branches viram preview. Substitui o script de upload.

---

## 6. Documentação

- `README.md` de produto (1 página): o que é, para quem, o que migrou, o que mudou, o que ficou de fora, próxima entrega. Exigência do case.
- `docs/arquitetura.md`: diagrama do modelo estrela, fluxos de autenticação e aprovação, mapa de rotas.
- `docs/decisoes.md`: continua como registro; cada decisão desta revisão vira um item novo (D11 em diante).
- `docs/operacao.md`: como convidar usuário, como rodar migrações, como restaurar.

---

## 7. Cronograma

Estimativa de trabalho focado. O case previa ~6 horas; este plano é uma
revisão de produto e passa disso. O corte de escopo está na seção 8.

| Fase | Entrega | Dias |
|---|---|---|
| **P0. Segurança e entrada** | Cadastro público desligado, `/` leva ao login, nome PlanOps, layout de app, RLS revisada para `authenticated` | 0,5 |
| **P1. Modelo estrela** | Dimensões, fatos, `usuario` e papéis, visões `vw_*`, migração validada por contagem, tipos gerados | 1,5 |
| **P2. Aplicação** | Início, Entregas (lista/novo/detalhe/abas), Clientes, Revisão de dados, Equipe, convites | 2,5 |
| **P3. Aprovação** | Links com revogação e reenvio, histórico a partir do fato, página pública revisada | 0,5 |
| **P4. Qualidade** | Testes unitários, RLS, e2e, CI, lint, acessibilidade | 1 |
| **P5. Entrega** | README de produto, arquitetura, operação, repositório no GitHub, deploy por git, vídeo | 0,5 |

Total: **~6,5 dias** de trabalho. Cada fase termina com o app no ar e os testes verdes.

---

## 8. Corte de escopo

**Obrigatório (MVP do case):** P0, P1, P2 (Início, Entregas, Entrega detalhe, Revisão de dados), P3, P4 (testes de RLS e e2e), P5.

**Pode ficar para depois (anotar no README como "próxima entrega"):** exportação
CSV, gráficos além do atraso por squad, Equipe com convites por e-mail
personalizado, e-mail de comprovante, notificações de prazo, alerta proativo.

---

## 9. Riscos

| Risco | Mitigação |
|---|---|
| Migração do modelo altera números | Validação por contagem antes de remover tabelas antigas; migração reversível |
| Políticas por papel quebram o app | Testes de RLS por papel na CI antes de cada merge |
| Escopo cresce além do case | Corte da seção 8 e fases com critério de pronto |
| Dados de teste expostos | Desligar cadastro, trocar senha da demo, nunca versionar credenciais |

---

## 10. Decisões que preciso de você

1. **Escopo:** MVP do case (P0–P5 enxuto) ou produto completo (com os itens "para depois")?
2. **Papéis:** os quatro papéis da seção 2.4 servem ou prefere só admin e operador?
3. **Ordem:** começo pela P0 (segurança e entrada) agora, sem esperar o resto do plano?
