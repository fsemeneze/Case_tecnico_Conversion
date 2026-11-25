-- ============================================================================
-- PlanOps — Migration 9 (parte 2): tabelas fato
--
-- Três fatos, três grãos:
--   fato_entrega        — uma linha por entrega (estado atual + medidas)
--   fato_evento_entrega — uma linha por mudança de fase ou de aprovação
--   fato_aprovacao      — uma linha por decisão do cliente, por etapa
--
-- Todas as medidas são derivadas de datas e contagens; nada de texto livre
-- onde deveria haver dimensão.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- fato_entrega — grão: entrega
-- ---------------------------------------------------------------------------

create table public.fato_entrega (
  id bigint generated always as identity primary key,

  -- Rastreabilidade da planilha (não é único: há IDs repetidos, D4).
  legacy_id integer,
  origem_id bigint not null references public.dim_origem (id),

  cliente_id bigint not null references public.dim_cliente (id),
  tipo_entrega_id bigint not null references public.dim_tipo_entrega (id),
  squad_id bigint references public.dim_squad (id),
  pessoa_id bigint references public.dim_pessoa (id),
  fase_id bigint not null references public.dim_fase (id),

  titulo text not null,

  -- Datas apontam para a dimensão calendário.
  data_solicitacao_id date references public.dim_data (id),
  data_prevista_id date references public.dim_data (id),
  data_entrega_id date references public.dim_data (id),

  aprovacao_planejamento_id bigint not null references public.dim_status_aprovacao (id),
  aprovacao_entrega_id bigint not null references public.dim_status_aprovacao (id),

  num_revisoes smallint check (num_revisoes >= 0),
  link text,
  observacoes text,

  -- Sinalizações da importação (D4): nada é apagado.
  flags text[] not null default '{}',
  origem_linha jsonb,

  -- Medidas
  dias_atraso integer generated always as (data_entrega_id - data_prevista_id) stored,
  dias_ciclo integer generated always as (data_entrega_id - data_solicitacao_id) stored,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_fato_entrega_cliente on fato_entrega (cliente_id);
create index idx_fato_entrega_fase on fato_entrega (fase_id);
create index idx_fato_entrega_origem on fato_entrega (origem_id);
create index idx_fato_entrega_legacy on fato_entrega (legacy_id) where legacy_id is not null;

-- Filtro mais frequente: abertas com prazo vencido (D8).
-- Os IDs de fase são fixos (migration 10); 1..5 são as fases abertas.
create index idx_fato_entrega_abertas_vencidas on fato_entrega (data_prevista_id)
  where data_prevista_id is not null and fase_id <= 5;

-- Busca por título no app.
create index idx_fato_entrega_titulo_trgm on fato_entrega using gin (titulo gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- fato_evento_entrega — grão: mudança de fase ou de aprovação
-- ---------------------------------------------------------------------------

create table public.fato_evento_entrega (
  id bigint generated always as identity primary key,
  entrega_id bigint not null references public.fato_entrega (id) on delete cascade,
  -- 'fase' | 'aprovacao_planejamento' | 'aprovacao_entrega' | 'campo'
  tipo_evento text not null,
  campo text,
  valor_antigo text,
  valor_novo text,
  fase_origem_id bigint references public.dim_fase (id),
  fase_destino_id bigint references public.dim_fase (id),
  autor text,
  origem_id bigint not null references public.dim_origem (id),
  criado_em timestamptz not null default now()
);

create index idx_evento_entrega on fato_evento_entrega (entrega_id, criado_em desc);
create index idx_evento_tipo on fato_evento_entrega (tipo_evento);

-- ---------------------------------------------------------------------------
-- fato_aprovacao — grão: decisão do cliente por etapa
-- ---------------------------------------------------------------------------

create table public.fato_aprovacao (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint not null references public.fato_entrega (id) on delete cascade,
  etapa_id bigint not null references public.dim_etapa_aprovacao (id),
  decisao_id bigint not null references public.dim_status_aprovacao (id),
  autor_nome text not null,
  autor_email text,
  observacao text,
  -- 'link' = aprovação do cliente via token; 'interno' = registro manual
  origem_id bigint not null references public.dim_origem (id),
  -- Medida: dias entre a solicitação e a decisão (calculada na inserção;
  -- `current_date` não é imutável e não pode entrar em coluna gerada).
  dias_ate_decisao integer,
  data_solicitacao date,
  data_decisao timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index idx_aprovacao_entrega on fato_aprovacao (entrega_id, criado_em desc);
create index idx_aprovacao_etapa on fato_aprovacao (etapa_id);