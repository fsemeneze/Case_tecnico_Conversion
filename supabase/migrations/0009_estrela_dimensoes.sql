-- ============================================================================
-- PlanHub — Migration 9: reconstrução do modelo (do zero)
--
-- Remove o modelo antigo e cria as dimensões do modelo estrela, com nomes
-- naturais. A carga vem na migration 12; a validação por contagem na 13.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Remove o modelo antigo (a reconstrução é do zero)
-- ---------------------------------------------------------------------------

drop table if exists public.entrega_historico cascade;
drop table if exists public.aprovacoes cascade;
drop table if exists public.erros_importacao cascade;
drop table if exists public.entregas cascade;
drop table if exists public.clientes cascade;

drop function if exists public.entrega_historico_fn();
drop function if exists public.set_updated_at();
drop function if exists public.criar_token_aprovacao(bigint, etapa_aprovacao, integer);
drop function if exists public.registrar_aprovacao(text, text, text, text, text);
drop function if exists public.dados_entrega_por_token(text);
drop function if exists public.links_aprovacao_ativos(bigint);

drop type if exists public.fase_entrega;
drop type if exists public.status_aprovacao;
drop type if exists public.etapa_aprovacao;
drop type if exists public.severidade_erro;

-- ---------------------------------------------------------------------------
-- Dimensões
-- ---------------------------------------------------------------------------

create table public.clientes (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

-- Ponte cliente ↔ grafia: as 31 grafias da planilha mapeiam para 25 clientes.
create table public.aliases_cliente (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  grafia text not null unique,
  origem text not null default 'planilha'
);

create index idx_alias_cliente on aliases_cliente (cliente_id);

create table public.pessoas (
  id bigint generated always as identity primary key,
  nome text not null unique,
  usuario_id uuid references auth.users (id),
  criado_em timestamptz not null default now()
);

create table public.squads (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table public.tipos_entrega (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('Relatório', 'Análise', 'Conteúdo')),
  subtipo text,
  unique (tipo, subtipo)
);

create table public.fases (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  -- 'aberta' | 'final' | 'cancelada' — usado no cálculo de atraso (D8)
  grupo text not null check (grupo in ('aberta', 'final', 'cancelada')),
  ordem smallint not null unique,
  descricao text
);

create table public.decisoes_aprovacao (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  -- true quando a decisão encerra a etapa
  conclusiva boolean not null default false
);

create table public.etapas_aprovacao (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null,
  ordem smallint not null unique
);

create table public.origens (
  id bigint generated always as identity primary key,
  codigo text not null unique,
  rotulo text not null
);

-- Calendário: toda data do modelo aponta para cá.
create table public.calendario (
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

create index idx_calendario_ano_mes on calendario (ano, mes);