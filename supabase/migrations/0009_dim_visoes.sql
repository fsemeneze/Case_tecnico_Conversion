-- ============================================================================
-- PlanOps — Migration 9 (parte 3): visões de leitura
--
-- O app lê apenas destas visões. `security_invoker = true` faz o RLS das
-- tabelas base valer para quem consulta (skill supabase).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- vw_entregas — uma linha por entrega, com o contexto resolvido
-- ---------------------------------------------------------------------------

create view public.vw_entregas
with (security_invoker = true) as
select
  f.id,
  f.legacy_id,
  f.titulo,
  f.tipo_entrega_id,
  t.tipo,
  t.subtipo,
  f.cliente_id,
  c.nome as cliente,
  f.squad_id,
  s.nome as squad,
  f.pessoa_id,
  p.nome as responsavel,
  f.fase_id,
  fa.codigo as fase,
  fa.rotulo as fase_rotulo,
  fa.grupo as fase_grupo,
  f.data_solicitacao_id as data_solicitacao,
  f.data_prevista_id as data_prevista,
  f.data_entrega_id as data_entrega,
  f.aprovacao_planejamento_id,
  ap.codigo as aprovacao_planejamento,
  f.aprovacao_entrega_id,
  ae.codigo as aprovacao_entrega,
  f.num_revisoes,
  f.link,
  f.observacoes,
  f.flags,
  f.origem_id,
  o.codigo as origem,
  f.dias_atraso,
  f.dias_ciclo,
  (f.data_prevista_id - current_date) as dias_restantes,
  f.criado_em,
  f.atualizado_em
from public.fato_entrega f
join public.dim_cliente c on c.id = f.cliente_id
join public.dim_tipo_entrega t on t.id = f.tipo_entrega_id
join public.dim_fase fa on fa.id = f.fase_id
join public.dim_status_aprovacao ap on ap.id = f.aprovacao_planejamento_id
join public.dim_status_aprovacao ae on ae.id = f.aprovacao_entrega_id
join public.dim_origem o on o.id = f.origem_id
left join public.dim_squad s on s.id = f.squad_id
left join public.dim_pessoa p on p.id = f.pessoa_id;

-- ---------------------------------------------------------------------------
-- vw_indicadores_mensais — agregados por mês, squad e cliente
-- ---------------------------------------------------------------------------

create view public.vw_indicadores_mensais
with (security_invoker = true) as
with base as (
  select
    d.ano,
    d.mes,
    f.squad_id,
    f.cliente_id,
    f.id,
    f.dias_atraso,
    (fa.grupo = 'aberta' and f.data_prevista_id < current_date) as vencida_aberta,
    (fa.grupo = 'aberta') as em_aberto,
    (f.dias_atraso > 0) as atrasada_concluida
  from public.fato_entrega f
  join public.dim_fase fa on fa.id = f.fase_id
  join public.dim_data d on d.id = f.data_prevista_id
)
select
  ano,
  mes,
  squad_id,
  cliente_id,
  count(*) as total_entregas,
  count(*) filter (where em_aberto) as em_aberto,
  count(*) filter (where vencida_aberta) as vencidas_abertas,
  count(*) filter (where atrasada_concluida) as atrasadas_concluidas,
  count(*) filter (where dias_atraso is not null) as comparaveis,
  round(
    100.0 * count(*) filter (where atrasada_concluida or vencida_aberta)
    / nullif(count(*) filter (where dias_atraso is not null or vencida_aberta), 0),
    1
  ) as taxa_atraso_pct
from base
group by ano, mes, squad_id, cliente_id;

-- ---------------------------------------------------------------------------
-- vw_eventos_entrega — histórico legível, com os rótulos das dimensões
-- ---------------------------------------------------------------------------

create view public.vw_eventos_entrega
with (security_invoker = true) as
select
  e.id,
  e.entrega_id,
  e.tipo_evento,
  e.campo,
  e.valor_antigo,
  e.valor_novo,
  e.autor,
  e.criado_em,
  fo.rotulo as fase_origem,
  fd.rotulo as fase_destino
from public.fato_evento_entrega e
left join public.dim_fase fo on fo.id = e.fase_origem_id
left join public.dim_fase fd on fd.id = e.fase_destino_id;