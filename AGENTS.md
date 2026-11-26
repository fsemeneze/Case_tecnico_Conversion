# AGENTS.md — PlanHub

Guia de trabalho para agentes de código (OpenCode, Claude Code, Cursor e afins).
Leia este arquivo inteiro antes de escrever a primeira linha: ele descreve o que o
projeto é, como se roda, onde cada coisa mora e quais regras não se violam.

O PlanHub é um app interno de **planejamento e entregas**: tira o controle de uma
planilha e o transforma em produto — diagnóstico dos dados, modelo em estrela no
Postgres e uma fatia funcional com aprovação do cliente por link.

## 1. Stack e versões

| Camada | Escolha | Versão |
| :--- | :--- | :--- |
| Framework | Next.js (App Router) | 16.4.6 |
| UI | React | 19.3.1 |
| Linguagem | TypeScript | 5.9.3 |
| Banco / Auth | Supabase (Postgres + Auth + RLS) | — |
| Estilo | CSS global + tokens em `app/globals.css` | — |
| Validação | Zod | 4.x |
| E-mail | Resend | — |
| Deploy | Vercel | — |
| Diagnóstico | Python | 3.10+ |

Requisitos locais: Node.js 20.9+ (testado com Node 26) e Python 3.10+.

## 2. Comandos

```bash
npm install              # dependências
npm run dev              # app em http://localhost:3000 (prepara docs antes)
npm run build            # build de produção (prepara docs antes)
npm run start            # serve o build
npm run typecheck        # tsc --noEmit — precisa passar sempre
npm run diagnostico      # gera docs/diagnostico.md e analysis/out/*
npm run test:diagnostico # testes do normalizador (Python unittest)
npm run demo:estado      # recria o estado de demonstração e emite links novos
npm run demo:estado -- --status   # mostra o estado atual, sem alterar
```

`predev` e `prebuild` rodam `scripts/preparar-docs.mjs`, que copia os docs de
produto para dentro do app. Não edite os arquivos gerados em `public/`.

## 3. Mapa do repositório

```
app/                      App Next.js (App Router)
  (app)/                  Rotas internas com menu lateral e guarda de sessão
    inicio/ dashboard/    Indicadores
    entregas/             Lista, filtros, cadastro, detalhe, histórico
    clientes/ revisao/    Clientes canônicos e fila de revisão da importação
    equipe/ conta/        Papéis, convites e segurança da conta (TOTP)
  aprovacao/[token]/      Página pública do cliente (aprovar/recusar)
  cliente/[token]/        Portal read-only do cliente
  login/                  Porta de entrada, recuperação e nova senha
  sobre/                  README de produto
  api/keepalive/          Cron diário que mantém o projeto ativo
  layout.tsx globals.css icones.tsx tema-toggle.tsx botao-copiar.tsx
lib/                      Clientes Supabase, consultas, validação, e-mail, fases
  supabase/               navegador.ts (cliente), servidor.ts (SSR), admin.ts (service role)
  consultas.ts            Camada de leitura — lê das visões, nunca das tabelas base
  validacao.ts            Schemas Zod compartilhados entre ação e formulário
  email.ts eventos.ts fases.ts
proxy.ts                  Guarda de login e usuário ativo (Next 16: ex-middleware)
analysis/                 diagnostico.py, test_diagnostico.py, out/ (saídas geradas)
supabase/migrations/      Modelo estrela, RLS, funções e carga (0001…0024)
docs/                     Diagnóstico, decisões, acessos, README de produto, testes
dados/                    Base original do case (CSV)
scripts/                  Importação, deploy, contas de teste, estado de demo
```

## 4. Convenções do código

- **Domínio em português.** Nomes de tabelas, colunas, funções, tipos e variáveis
  de negócio ficam em português (`entregas_detalhadas`, `listarEntregas`,
  `ResultadoCadastro`). Termos técnicos consagrados ficam em inglês (`proxy`,
  `layout`, `server action`).
- **Server Components por padrão.** Só acrescente `"use client"` quando houver
  estado, evento ou hook de navegador. Formulários usam Server Actions.
- **Server Actions** moram em `actions.ts` ao lado da rota, começam com
  `"use server"` e retornam um *union* discriminado (`{ ok: true, ... } |
  { ok: false, erro }`). Nunca lance erro cru para a tela.
- **Validação sempre com Zod** em `lib/validacao.ts`, compartilhada entre a ação
  (servidor) e o formulário (cliente). Uma regra, um schema.
- **Leitura vem das visões** (`entregas_detalhadas`, `eventos_detalhados`,
  `indicadores_mensais`). O app não consulta tabelas base: a regra de negócio
  vive no banco, e o app só apresenta.
- **Escrita respeita o RLS.** Use o cliente de servidor com a sessão do usuário;
  o cliente admin (service role) só em rotas de servidor e scripts locais.
- **Alias `@/*`** aponta para a raiz (ver `tsconfig.json`). Importe
  `@/lib/...`, não caminhos relativos longos.
- **Ícones** são SVG autoral em `app/icones.tsx` (traço 1.75, `currentColor`).
  Nada de emoji ou glifo Unicode como ícone.
- **Visual** segue `DESIGN.md` (tokens, tipografia, raio, estados). Não invente
  cor fora da paleta.

## 5. Banco de dados (Supabase)

- Migrations em `supabase/migrations/` são incrementais e numeradas
  (`0001_base.sql`, `0002_rls.sql`, …). **Nunca edite uma migration já aplicada**;
  crie a próxima com o número seguinte.
- **RLS é obrigatório** em toda tabela de negócio. Política por papel
  (`admin`, `gestor`, `operador`, `leitor`) e por `cliente_id` quando couber.
- Operações públicas (aprovação por token) usam funções `SECURITY DEFINER` que
  expõem **apenas** a entrega do token — nada além.
- A importação preserva a linha original em JSON e marca `flags`; **nada é
  apagado em silêncio**. Duplicados vão para a fila de revisão.
- Modelo em estrela: fatos (`entregas`, `eventos_entrega`, `aprovacoes`) e
  dimensões (`clientes`, `fases`, `calendario`, …). Prefira consultar visões a
  juntar dimensões no cliente.
- Conexão de importação usa o pooler (`*.pooler.supabase.com`, IPv4); o host
  direto `db.<ref>.supabase.co` só resolve IPv6.

## 6. Autenticação e segurança

- Login por convite, sem cadastro público. A guarda mora em `proxy.ts`: exige
  sessão **e** `usuario.ativo`; sem isso, redireciona para `/login`.
- O cliente **não tem conta**: aprova por link com token único por entrega/etapa,
  com expiração, uso único, e-mail obrigatório e origem (IP/user-agent) registrada.
  Link novo revoga o anterior.
- **Segredos nunca no cliente.** `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `DATABASE_URL` e `DB_PASSWORD` são só de servidor. `NEXT_PUBLIC_*` é o que
  pode ir para o navegador.
- **Nada de credencial no repositório.** `.env*` está no `.gitignore` (salvo
  `.env.example`); senhas e links de avaliação vão no e-mail, nunca no repo.
- O repositório é público: nada interno, senha ou link de cliente pode ficar no
  HEAD. Ao mudar algo sensível, confira `git diff` antes de commitar.

## 7. E-mail (Resend)

- O provedor está em **modo de teste** (domínio não verificado): só entrega ao
  e-mail da própria conta Resend. Isso é limitação declarada, não bug.
- A falha aparece na tela com o motivo, e o link de aprovação continua visível
  para copiar e enviar pelo canal de contato. Não esconda o erro nem trave o fluxo.
- `EMAIL_FROM` e `EMAIL_EQUIPE` vêm do ambiente; não hardcode.

## 8. Dados de demonstração

- Três entregas da **Escola Saber Mais** cobrem os estados da apresentação
  (#1035 planejamento pendente, #1036 entrega pendente, #1037 em produção vencida).
- São marcadas com `origem_linha->>'demo'`. `npm run demo:estado` mexe **só** nelas.
- Aprovar pelo link consome o token; por isso existe o reset, que recria o estado e
  emite links novos. Não crie demo fora dessa marcação.

## 9. O que não fazer

- Não editar migrations já aplicadas nem apagar dados de produção semear.
- Não expor service role, senha ou token no cliente, em log ou no repositório.
- Não introduzir `middleware.ts`: o Next 16 usa `proxy.ts`.
- Não tratar `params`/`searchParams` como objetos síncronos — são Promises.
- Não pular `npm run typecheck` nem `npm run test:diagnostico` antes de dizer que
  terminou.
- Não inventar cor, ícone ou padrão visual fora de `DESIGN.md`.
- Não remover o bloco "nextjs-agent-rules" ao final deste arquivo: ele é gerado e
  re-adicionado por `next dev`.

## 10. Definição de pronto

Uma mudança só está pronta quando:

1. `npm run typecheck` passa limpo.
2. `npm run build` passa (ou o `dev` roda sem erro na rota alterada).
3. `npm run test:diagnostico` passa, se você mexeu no normalizador.
4. A regra de negócio está no lugar certo (banco/visão, não no cliente).
5. Nenhum segredo, senha ou link de avaliação entrou no diff.
6. Comportamento novo está refletido em `docs/` (decisões, README de produto).

## 11. Antes de escrever código, leia a doc da versão

O Next 16 tem APIs e convenções diferentes das versões anteriores. Consulte o
guia da versão instalada em `node_modules/next/dist/docs/` antes de escrever
código, e respeite os avisos de depreciação.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
