# DESIGN.md — PlanHub

Mundo visual do PlanHub, derivado do padrão da Conversion
(https://www.conversion.com.br/). Documento de referência para manter o
refino coeso: identidade preservada, acabamento elevado.

## Modo

- **Operate** (início, entregas, clientes, revisão, equipe, conta): precisão,
  escaneabilidade e consistência. A marca vive nos detalhes.
- **Persuade** (login, recuperação de senha, sobre, aprovação do cliente):
  converter confiança; mais personalidade, mantendo o hero.

## Paleta

| Token | Valor | Uso |
|---|---|---|
| `--accent` | `#1649ff` | Ação primária, foco, links |
| `--accent-strong` | `#1100d2` | Hover da ação primária |
| `--accent-soft` | `#eef2ff` | Fundo de estado ativo / badges info |
| `--bg` / `--card` | `#ffffff` | Superfícies |
| `--surface-subtle` | `#fbfbfd` | Sidebar, cabeçalho de tabela, filtros |
| `--surface-hover` | `#f1f4fb` | Hover de itens de menu |
| `--surface-row` | `#fcfcff` | Hover de linha de tabela |
| `--text-soft` | `#404555` | Rótulos e texto secundário |
| `--fg` / `--muted` | `#0e0e10` / `#6b7280` | Texto principal / apoio |
| `--border` | `#e6e9ef` | Linhas e bordas |
| `--ok` / `--warn` | `#0f7b52` / `#b45309` | Sucesso / alerta |

Hero de auth: azul-marinho `#000931` com gradiente perolado no canto inferior
direito (`rgba(191,205,255,.47)` → `rgba(23,23,39,.47)`).

## Tipografia

- Títulos: **Plus Jakarta Sans** (`--font-jakarta`), peso 650–700, tracking
  −0.025 a −0.035em.
- Texto: **Inter** (`--font-inter`), 1.6 de entrelinha.
- Escala: h1 `clamp(1.9rem, 4vw, 2.6rem)`; h2 `1.05rem`; corpo 0.9–1rem.
- Números de dados: `font-variant-numeric: tabular-nums`.

## Forma e profundidade

- Raio base `--radius: 14px`; controles 9–10px; pílulas 999px.
- Sombras com deslocamento e blur suave:
  `--shadow-card` (repouso) e `--shadow-pop` (hover/elevação).
- Sem barra lateral decorativa em caixa arredondada; estado ativo usa tint
  + cor, não borda de um lado só.

## Ícones

SVG autoral em `app/icones.tsx`: traço único 1.75, cantos arredondados,
`currentColor`. Nada de emoji ou glifo Unicode como ícone.

## Estados

Hover, foco de teclado (`:focus-visible` com anel azul), disabled, loading,
erro e vazio. Seleção de texto e scrollbar tematizadas a partir da paleta.

## Verificação

`npm run typecheck` limpo; telas públicas e internas conferidas no dev server
(porta 3000) com a conta de teste admin.