# Acesso para avaliação

Como testar o PlanHub sem depender de quem construiu. Senhas, link do portal e
links de aprovação **não ficam neste repositório público**: vão no e-mail de
entrega e no arquivo local `.credenciais-avaliador.md`.

**App no ar:** https://planhub-co.vercel.app/login

## Contas por perfil

Uma conta por papel, todas ativas. A senha de cada uma está no e-mail de
entrega.

| Perfil | E-mail | O que pode fazer |
| :--- | :--- | :--- |
| Admin | `admin@planhub.case` | Tudo: entregas, clientes, equipe, convites, revisão e links |
| Gestor | `gestor@planhub.case` | Entregas, clientes, links de aprovação e avisos; não mexe em equipe |
| Operador | `operador@planhub.case` | Cadastra e edita entregas; não gera links nem administra |
| Leitor | `leitor@planhub.case` | Só consulta (a RLS bloqueia escrita) |

Para testar a RLS de verdade, entre como **leitor** e tente cadastrar uma
entrega: o botão aparece, o envio é recusado pelo banco.

## Link do cliente (sem conta)

O cliente não tem login: recebe um link somente leitura com todas as entregas
dele e a lista "Entregas aguardando você". O link do e-mail abre o portal do
cliente **Escola Saber Mais**, que tem três entregas de demonstração (abaixo).

Regra do produto: gerar um link novo revoga o anterior, tanto no portal quanto
na aprovação por entrega. Se você gerar outro em Clientes → "Gerar link", o link
recebido no e-mail deixa de funcionar.

## Entregas de demonstração

Três entregas do cliente Escola Saber Mais, cobrindo os estados que o vídeo
mostra:

| Entrega | Estado | Onde ver |
| :--- | :--- | :--- |
| #1035 Planejamento: calendário editorial de dezembro | Aguardando o cliente | Portal do cliente e link de planejamento |
| #1036 Relatório mensal de novembro | Aguardando aprovação da entrega | Portal do cliente e link de entrega |
| #1037 Auditoria técnica do site | Em produção, prazo vencido há 6 dias | Lista de entregas e indicadores de atraso |

Os dois links de aprovação vão no e-mail de entrega. São de **uso único**: ao
aprovar, a fase muda, o token é consumido e a decisão entra no histórico com
nome, e-mail, data, observação e IP.

Para voltar ao estado inicial (depois de aprovar, ou antes de outra tomada do
vídeo):

```bash
npm run demo:estado            # recria as três entregas e emite links novos
npm run demo:estado -- --status # só mostra o estado atual
```

O comando mexe apenas nas entregas marcadas como demonstração; nada importado é
alterado. Ele imprime os links de aprovação ativos.

## Rodar localmente

Requisitos: Node.js 20.9+ e Python 3.10+ (diagnóstico).

```bash
npm install
cp .env.example .env.local   # preencha as variáveis abaixo
npm run dev                  # http://localhost:3000
```

Variáveis necessárias (`.env.example` tem a descrição de cada uma):

| Variável | Para quê |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Projeto Supabase do case |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (cliente e sessão) |
| `SUPABASE_SERVICE_ROLE_KEY` | Só no servidor: links por token, aprovação e admin |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_EQUIPE` | Envio de e-mail (opcional) |
| `DATABASE_URL` ou `DB_PASSWORD` | Apenas para reimportar a planilha |

O app funciona sem as variáveis de e-mail: a geração de link continua, e a tela
mostra que o envio não saiu.

## Reproduzir a base

```bash
npm run diagnostico               # gera analysis/out/* e o relatório interno
npm run test:diagnostico          # testes do normalizador
node scripts/importar-para-supabase.mjs   # migrations + carga no Supabase
```

## Duas limitações declaradas

1. **E-mail em modo de teste.** O Resend está sem domínio verificado, então só
   entrega ao e-mail da conta do provedor. A tela não finge: mostra o motivo, o
   endereço liberado e mantém o link visível para copiar. Verificar um domínio
   no Resend resolve, sem mudar código.
2. **Segundo fator (TOTP)** existe em `/conta`, mas não é obrigatório para as
   contas de teste — se quiser ver o fluxo, ative em uma delas.
