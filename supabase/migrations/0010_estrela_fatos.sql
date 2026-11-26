-- ============================================================================
-- PlanHub — Migration 10: fatos
--
-- Três fatos, três grãos:
--   entregas        — uma linha por entrega (estado atual + medidas)
--   eventos_entrega — uma linha por mudança de fase ou de aprovação
--   aprovacoes      — uma linha por decisão do cliente, por etapa
--
-- As medidas vêm de datas e contagens; nada de texto livre onde deveria
-- haver dimensão.
-- ============================================================================

create table public.entregas (
  id bigint generated always as identity primary key,

  -- Rastreabilidade da planilha (não é único: há IDs repetidos, D4).
  legacy_id integer,
  origem_id bigint not null references public.origens (id),

  cliente_id bigint not null references public.clientes (id),
  tipo_entrega_id bigint not null references public.tipos_entrega (id),
  squad_id bigint references public.squads (id),
  pessoa_id bigint references public.pessoas (id),
  fase_id bigint not null references public.fases (id),

  titulo text not null,

  data_solicitacao_id date references public.calendario (id),
  data_prevista_id date references public.calendario (id),
  data_entrega_id date references public.calendario (id),

  aprovacao_planejamento_id bigint not null references public.decisoes_aprovacao (id),
  aprovacao_entrega_id bigint not null references public.decisoes_aprovacao (id),

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

create index idx_entregas_cliente on entregas (cliente_id);
create index idx_entregas_fase on entregas (fase_id);
create index idx_entregas_origem on entregas (origem_id);
create index idx_entregas_legacy on entregas (legacy_id) where legacy_id is not null;

-- Filtro mais frequente: abertas com prazo vencido (D8).
-- Os IDs de fase são fixos (migration 12); 1..5 são as fases abertas.
create index idx_entregas_abertas_vencidas on entregas (data_prevista_id)
  where data_prevista_id is not null and fase_id <= 5;

create index idx_entregas_titulo_trgm on entregas using gin (titulo gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- eventos_entrega — grão: mudança de fase ou de aprovação
-- ---------------------------------------------------------------------------

create table public.eventos_entrega (
  id bigint generated always as identity primary key,
  entrega_id bigint not null references public.entregas (id) on delete cascade,
  -- 'fase' | 'aprovacao_planejamento' | 'aprovacao_entrega' | 'campo' | 'importacao'
  tipo_evento text not null,
  campo text,
  valor_antigo text,
  valor_novo text,
  fase_origem_id bigint references public.fases (id),
  fase_destino_id bigint references public.fases (id),
  autor text,
  origem_id bigint not null references public.origens (id),
  criado_em timestamptz not null default now()
);

create index idx_evento_entrega on eventos_entrega (entrega_id, criado_em desc);
create index idx_evento_tipo on eventos_entrega (tipo_evento);

-- ---------------------------------------------------------------------------
-- aprovacoes — grão: decisão do cliente por etapa
-- ---------------------------------------------------------------------------

create table public.aprovacoes (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint not null references public.entregas (id) on delete cascade,
  etapa_id bigint not null references public.etapas_aprovacao (id),
  decisao_id bigint not null references public.decisoes_aprovacao (id),
  autor_nome text not null,
  autor_email text,
  observacao text,
  origem_id bigint not null references public.origens (id),
  -- Medida: dias entre a solicitação e a decisão (calculada na inserção;
  -- `current_date` não é imutável e não pode entrar em coluna gerada).
  dias_ate_decisao integer,
  data_solicitacao date,
  data_decisao timestamptz not null default now(),
  criado_em timestamptz not null default now()
);

create index idx_aprovacao_entrega on aprovacoes (entrega_id, criado_em desc);
create index idx_aprovacao_etapa on aprovacoes (etapa_id);

-- ---------------------------------------------------------------------------
-- erros_importacao — grão: problema encontrado na importação
-- ---------------------------------------------------------------------------

create table public.erros_importacao (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint references public.entregas (id) on delete set null,
  legacy_id integer,
  codigo text not null,
  severidade text not null check (severidade in ('aviso', 'critico')),
  detalhe text,
  origem_linha jsonb,
  resolvido boolean not null default false,
  resolvido_por uuid references auth.users (id),
  resolvido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_erro_entrega on erros_importacao (entrega_id);
create index idx_erro_pendentes on erros_importacao (resolvido) where not resolvido;
create index idx_erro_codigo on erros_importacao (codigo);