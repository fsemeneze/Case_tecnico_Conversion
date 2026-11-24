-- ============================================================================
-- Fase 2 — Migration 1: extensões, enums e tabelas
--
-- Modelo de docs/decisoes.md (D2, D4, D9):
--   - fase (andamento) separada de aprovação (decisão do cliente)
--   - nada é apagado: inconsistências da planilha entram com flags
--   - linha original preservada em origem_linha (jsonb) para auditoria
-- ============================================================================

-- Busca por título ("ILIKE %termo%") no app.
create extension if not exists pg_trgm;

-- Schema privado: nunca exposto pela Data API. Guarda tokens e funções
-- de aprovação (D3). Tabelas aqui nem chegam ao anon/authenticated.
create schema if not exists aprovacao_priv;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Vocabulário exato do diagnóstico (mapa_status.csv). `solicitada` não existe
-- na planilha, mas é o estado inicial de toda entrega criada no app.
create type fase_entrega as enum (
  'solicitada',
  'em_producao',
  'aguardando_cliente',
  'aguardando_aprovacao_entrega',
  'ajuste_solicitado',
  'entregue',
  'aprovada',
  'cancelada'
);

-- Dimensão de aprovação (D2, D6): decisão do cliente por etapa.
-- `nao_aplica` = etapa não existe para o tipo (ex.: planejamento de relatório);
-- `nao_informado` = etapa existe mas a planilha não registra.
create type status_aprovacao as enum (
  'pendente',
  'aprovada',
  'aprovada_com_ressalvas',
  'recusada',
  'nao_aplica',
  'nao_informado'
);

create type etapa_aprovacao as enum ('planejamento', 'entrega');

create type severidade_erro as enum ('aviso', 'critico');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table clientes (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table entregas (
  id bigint generated always as identity primary key,

  -- Identidade na planilha original. NÃO é unique: o diagnóstico encontrou
  -- 12 IDs repetidos (D4). A identidade real é `id`; `legacy_id` rastreia
  -- a origem. Nulo para entregas criadas direto no app.
  legacy_id integer,
  cliente_id bigint not null references clientes (id) on delete restrict,

  titulo text not null,
  tipo text not null check (tipo in ('Relatório', 'Análise', 'Conteúdo')),
  subtipo text,
  squad text,
  responsavel text,

  data_solicitacao date,
  data_prevista date,
  data_entrega date,

  fase fase_entrega not null default 'solicitada',
  aprovacao_planejamento status_aprovacao not null default 'pendente',
  aprovacao_entrega status_aprovacao not null default 'pendente',

  -- NULL quando a planilha traz 99, -1 ou texto ambíguo (flag no CSV).
  num_revisoes smallint check (num_revisoes >= 0),

  link text,
  observacoes text,

  -- Sinalizações do diagnóstico: 'id_duplicado', 'possivel_duplicata',
  -- 'sem_link', 'data_*_texto_ano_inferido', 'aprovacao_sem_status_final'...
  flags text[] not null default '{}',

  -- Linha original da planilha, preservada para auditoria (D4).
  origem_linha jsonb,

  -- Atraso da definição única (D8): dias entre previsto e entregue.
  -- Positivo = atrasada; negativo = adiantada; NULL quando incomparável.
  -- Em aberto com prazo vencido é calculado na consulta
  -- (data_prevista < hoje e fase não final), não aqui.
  dias_atraso integer generated always as (data_entrega - data_prevista) stored,

  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table aprovacoes (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint not null references entregas (id) on delete cascade,
  etapa etapa_aprovacao not null,
  decisao status_aprovacao not null
    check (decisao in ('aprovada', 'aprovada_com_ressalvas', 'recusada')),
  autor_nome text not null,
  autor_email text,
  observacao text,
  -- 'link' = aprovação do cliente via token; 'interno' = registro manual
  origem text not null default 'link',
  criado_em timestamptz not null default now()
);

-- Histórico de mudanças, alimentado pelo trigger da migration 3.
create table entrega_historico (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint not null references entregas (id) on delete cascade,
  campo text not null,
  valor_antigo text,
  valor_novo text,
  autor text,
  criado_em timestamptz not null default now()
);

-- Fila de revisão da importação (D4): erros_qualidade.csv do diagnóstico.
create table erros_importacao (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint references entregas (id) on delete set null,
  legacy_id integer,
  codigo text not null,
  severidade severidade_erro not null,
  detalhe text,
  origem_linha jsonb,
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create index idx_entregas_cliente on entregas (cliente_id);
create index idx_entregas_fase on entregas (fase);
create index idx_entregas_legacy on entregas (legacy_id) where legacy_id is not null;

-- Lista de abertas com prazo vencido: filtro mais frequente do app.
create index idx_entregas_abertas_prevista on entregas (data_prevista)
  where data_prevista is not null
    and fase in (
      'solicitada', 'em_producao', 'aguardando_cliente',
      'aguardando_aprovacao_entrega', 'ajuste_solicitado'
    );

create index idx_entregas_titulo_trgm on entregas using gin (titulo gin_trgm_ops);

create index idx_aprovacoes_entrega on aprovacoes (entrega_id);
create index idx_historico_entrega on entrega_historico (entrega_id, criado_em);
create index idx_erros_pendentes on erros_importacao (resolvido) where not resolvido;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entregas_set_updated_at
  before update on entregas
  for each row execute function set_updated_at();
