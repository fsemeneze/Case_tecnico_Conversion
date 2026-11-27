# PlanHub — plano de testes

Como validar o app antes de mostrar. Cada caso tem um resultado esperado
concreto, para dar para marcar "passou" ou "falhou" sem interpretação.

**Conta de teste:** credenciais enviadas à parte (não versionadas neste repositório público).
**Base:** 1.007 linhas na planilha, 989 entregas no banco (986 importadas +
3 de demonstração, após a deduplicação de IDs e links repetidos), 25 clientes.

---

## 1. Acesso e login

| # | Cenário | Passos | Esperado |
| :-- | :--- | :--- | :--- |
| 1.1 | Login válido | Entrar com e-mail e senha da conta de teste | Vai para `/inicio` e o menu mostra "Administrador" |
| 1.2 | Senha errada | Senha inválida | "E-mail ou senha incorretos." — não diz qual campo errou |
| 1.3 | E-mail inexistente | E-mail aleatório | Mesma mensagem genérica (não revela se existe) |
| 1.4 | Rota protegida sem login | Abrir `/entregas` sem sessão | Redireciona para `/login` |
| 1.5 | Usuário desativado | Admin desativa a própria conta de teste em `/equipe` e tenta entrar | Não entra; o proxy barra mesmo com senha certa |
| 1.6 | Esqueci a senha | `/login` → "Esqueci minha senha" → e-mail válido | "Confira seu e-mail"; link chega e vale 1 hora |
| 1.7 | Nova senha | Abrir o link do e-mail, digitar senha e confirmar | Salva e vai para `/inicio` |
| 1.8 | Link expirado | Abrir o link depois de 1 hora | "Este link expirou. Peça um novo…" |

## 2. Lista de entregas com filtros e busca

| # | Cenário | Passos | Esperado |
| :-- | :--- | :--- | :--- |
| 2.1 | Lista completa | Abrir `/entregas` | 50 linhas, total "989 entregas", ordenadas por prazo |
| 2.2 | Busca por título | Digitar "Relatório mensal" | Só títulos que contêm o termo; total muda |
| 2.3 | Filtro por cliente | Selecionar "Loja Alfa" | Só entregas da Loja Alfa |
| 2.4 | Filtro por fase | Selecionar "Aprovada" | 799 entregas |
| 2.5 | Filtro por tipo | Selecionar "Análise" | 248 entregas |
| 2.6 | Apenas em atraso | Marcar o checkbox | 273 entregas (D8: concluídas após o prazo + abertas vencidas) |
| 2.7 | Vencidas (em aberto) | Marcar o checkbox | 71 entregas |
| 2.8 | Filtros combinados | Cliente + fase + atraso | Interseção coerente, total menor que cada filtro isolado |
| 2.9 | Limpar filtros | Clicar em "Limpar" | Volta aos 989 |
| 2.10 | Paginação | Ir para a página 2 | 50 linhas novas, sem repetir as da página 1 |
| 2.11 | Sem resultado | Buscar "zzzz" | "Nenhuma entrega com esses filtros." |
| 2.12 | Filtro na URL | Copiar a URL com filtros e abrir em outra aba | Os filtros continuam aplicados |

## 3. Cadastro de novas entregas

| # | Cenário | Passos | Esperado |
| :-- | :--- | :--- | :--- |
| 3.1 | Cadastro mínimo | `/entregas/nova` com título, cliente e tipo | Salva, abre o detalhe, fase "Solicitada" |
| 3.2 | Cliente novo | Deixar "Cliente" vazio e preencher "Novo cliente" | Cliente criado e vinculado |
| 3.3 | Título curto | Digitar "ab" | Erro "Informe um título com pelo menos 3 caracteres" |
| 3.4 | Link inválido | Preencher "ftp://x" | Erro "O link deve começar com http:// ou https://" |
| 3.5 | Data inválida | Data prevista anterior à solicitação | Salva (a base permite), mas o atraso aparece no detalhe |
| 3.6 | Campos opcionais | Deixar squad, responsável e observações em branco | Salva sem erro |
| 3.7 | Perfil leitor | Entrar como leitor e tentar cadastrar | "Seu perfil só pode consultar." |

## 4. Aprovação do cliente (duas etapas)

| # | Cenário | Passos | Esperado |
| :-- | :--- | :--- | :--- |
| 4.1 | Gerar link | No detalhe, "Gerar link de planejamento" | Mostra o link com o token; "1 link ativo" |
| 4.2 | Aprovar planejamento | Abrir o link, aprovar com nome | "Tudo certo"; fase vai para "Em produção" |
| 4.3 | Recusar planejamento | Novo link, "Solicitar ajuste" | Fase "Ajuste solicitado"; observação registrada |
| 4.4 | Aprovar entrega | Link da etapa 2, aprovar | Fase "Aprovada" |
| 4.5 | Token usado | Recarregar a página do link já aprovado | "Este link não está mais válido" |
| 4.6 | Token expirado | Gerar link, esperar 7 dias (ou ajustar no banco) | "Token inválido, expirado ou já utilizado" |
| 4.7 | Token inexistente | Abrir `/aprovacao/qualquer-coisa` | Tela de link inválido, sem erro técnico |
| 4.8 | Sem nome | Tentar confirmar com o nome vazio | "Informe o nome de quem está aprovando." |
| 4.9 | Histórico | Voltar ao detalhe | Aprovação em "Aprovações registradas" e evento em "Histórico" |
| 4.10 | Autor | Conferir o histórico | Autor "Cliente via link: <nome>" |

## 5. Clientes, revisão e equipe

| # | Cenário | Passos | Esperado |
| :-- | :--- | :--- | :--- |
| 5.1 | Lista de clientes | `/clientes` | 25 clientes, com grafias e contagem de entregas |
| 5.2 | Busca de cliente | Digitar "Loja" | Só os que contêm "Loja" |
| 5.3 | Resolver erro | `/revisao` → "Resolver" em um item | Sai dos pendentes; some da lista |
| 5.4 | Reabrir | Em "Resolvidos" → "Reabrir" | Volta para pendentes |
| 5.5 | Filtrar críticos | Severidade "Crítico" | 193 itens |
| 5.6 | Convidar | `/equipe` → convidar e-mail válido | "Convite enviado"; aparece em Convites |
| 5.7 | Trocar papel | Mudar um usuário para "leitor" | Papel atualizado na lista |
| 5.8 | Desativar a si mesmo | Tentar desativar a própria conta | Botão desabilitado |

## 6. Segurança (RLS por papel)

Teste com uma conta de cada papel (criadas por convite).

| # | Papel | Ação | Esperado |
| :-- | :--- | :--- | :--- |
| 6.1 | leitor | Cadastrar entrega | Bloqueado: "Seu perfil só pode consultar." |
| 6.2 | leitor | Gerar link de aprovação | Redireciona com aviso de perfil |
| 6.3 | operador | Cadastrar e editar | Permitido |
| 6.4 | operador | Convidar usuário | Bloqueado (só admin) |
| 6.5 | gestor | Gerar link | Permitido |
| 6.6 | gestor | Excluir entrega | Bloqueado (só admin) |
| 6.7 | admin | Tudo | Permitido |
| 6.8 | anon | Chamar a API direto com a chave publicável | Nenhuma linha retorna (RLS + REVOKE) |

## 7. Casos de borda da base

| # | Cenário | Esperado |
| :-- | :--- | :--- |
| 7.1 | Entrega com ID repetido (ex.: 2 linhas com o mesmo legacy_id) | As duas aparecem; o vínculo na fila de revisão fica só por legacy_id |
| 7.2 | Entrega sem link | "—" na coluna e flag "sem_link" no detalhe |
| 7.3 | Entrega com data em serial do Excel | Data normalizada corretamente; flag de serial |
| 7.4 | Entrega com ano inferido ("10/nov") | Data preenchida; flag "ano inferido" |
| 7.5 | Revisões = 99 | Nulo, com flag "revisoes_outlier" |
| 7.6 | Entrega cancelada com prazo vencido | Não conta como atraso (grupo "cancelada") |

---

## Como rodar os testes automatizados

```bash
# normalizador (Python)
python -m unittest discover -s analysis -v
```

Não há suíte de testes do app versionada: a validação das regras de fase,
atraso (D8) e RLS é feita pelos cenários acima e pelos relatórios em
`docs/testes/`.

## Registro de execução

| Data | Versão | Resultado | Observações |
| :--- | :--- | :--- | :--- |
| 2026-11-25 | deploy `dpl_7x8togRS` | 1.1 a 4.10 verificados manualmente | — |