-- ============================================================================
-- PlanOps — Migration 9: modelo estrela (dimensões)
--
-- Reconstrução do modelo do zero. Tabelas fato guardam medidas e eventos;
-- dimensões guardam o contexto. A migration 10 preenche e valida; a 11
-- remove o modelo antigo.
--
-- Convenções:
--   - dim_* com chave substituta (bigint) e chave natural (código) única.
--   - fato_* com FKs para as dimensões, nunca texto livre.
--   - dim_data é o calendário; toda data da fato aponta para ela.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Dimensões de catálogo
-- ---------------------------------------------------------------------------

create table public.dim_cliente (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

-- Ponte cliente ↔ grafia: as 31 grafias da planilha mapeiam para 25 clientes.
create table public.ponte_cliente_alias (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.dim_cliente (id) on delete cascade,
  grafia text not null unique,
  origem text not null default 'planilha'
);

create index idx_alias_cliente on ponte_cliente_alias (cliente_id);

create table public.dim_pessoa (
  id bigint generated always as identity primary key,
  nome text not null unique,
  usuario_id uuid references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.dim_squad (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table public.dim_tipo_entrega (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('Relatório', 'Análise', 'Conteúdo')),
  subtipo text,
  unique (tipo, subtipo)
);

create table public.dim_fase (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  -- 'aberta' | 'final' | 'cancelada' — usado no cálculo de atraso (D8)
  grupo text not null check (grupo in ('aberta', 'final', 'cancelada')),
  ordem smallint not null unique,
  descricao text
);

create table public.dim_status_aprovacao (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  -- true quando a decisão encerra a etapa
  conclusiva boolean not null default false
);

create table public.dim_etapa_aprovacao (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  ordem smallint not null unique
);

create table public.dim_origem (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null
);

-- ---------------------------------------------------------------------------
-- Dimensão data (calendário)
-- ---------------------------------------------------------------------------

create table public.dim_data (
  id date primary key,
  ano smallint not null,
  semestre smallint not null,
  trimestre smallint not null,
  mes smallint not null,
  nome_mes text not null,
  dia smallint not null,
  dia_semana smallint not null,
  nome_dia_semana text not null,
  semana_ano smallint not null,
  eh_dia_util boolean not null,
  eh_fim_de_semana boolean not null
);

create index idx_dim_data_ano_mes on dim_data (ano, mes);