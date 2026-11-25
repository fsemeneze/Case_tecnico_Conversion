-- ============================================================================
-- PlanOps — Migration 11: visões de leitura
--
-- O app lê apenas destas visões. `security_invoker = true` faz o RLS das
-- tabelas base valer para quem consulta (skill supabase).
-- ============================================================================

-- Uma linha por entrega, com o contexto resolvido.
create view public.entregas_detalhadas
with (security_invoker = true) as
select
  e.id,
  e.legacy_id,
  e.titulo,
  e.tipo_entrega_id,
  t.tipo,
  t.subtipo,
  e.cliente_id,
  c.nome as cliente,
  e.squad_id,
  s.nome as squad,
  e.pessoa_id,
  p.nome as responsavel,
  e.fase_id,
  f.codigo as fase,
  f.rotulo as fase_rotulo,
  f.grupo as fase_grupo,
  e.data_solicitacao_id as data_solicitacao,
  e.data_prevista_id as data_prevista,
  e.data_entrega_id as data_entrega,
  e.aprovacao_planejamento_id,
  ap.codigo as aprovacao_planejamento,
  e.aprovacao_entrega_id,
  ae.codigo as aprovacao_entrega,
  e.num_revisoes,
  e.link,
  e.observacoes,
  e.flags,
  e.origem_id,
  o.codigo as origem,
  e.dias_atraso,
  e.dias_ciclo,
  (e.data_prevista_id - current_date) as dias_restantes,
  e.criado_em,
  e.atualizado_em
from public.entregas e
join public.clientes c on c.id = e.cliente_id
join public.tipos_entrega t on t.id = e.tipo_entrega_id
join public.fases f on f.id = e.fase_id
join public.decisoes_aprovacao ap on ap.id = e.aprovacao_planejamento_id
join public.decisoes_aprovacao ae on ae.id = e.aprovacao_entrega_id
join public.origens o on o.id = e.origem_id
left join public.squads s on s.id = e.squad_id
left join public.pessoas p on p.id = e.pessoa_id;

-- Agregados por mês, squad e cliente.
create view public.indicadores_mensais
with (security_invoker = true) as
with base as (
  select
    d.ano,
    d.mes,
    e.squad_id,
    e.cliente_id,
    e.id,
    e.dias_atraso,
    (f.grupo = 'aberta' and e.data_prevista_id < current_date) as vencida_aberta,
    (f.grupo = 'aberta') as em_aberto,
    (e.dias_atraso > 0) as atrasada_concluida
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  join public.calendario d on d.id = e.data_prevista_id
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

-- Histórico legível, com os rótulos das dimensões.
create view public.eventos_detalhados
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
from public.eventos_entrega e
left join public.fases fo on fo.id = e.fase_origem_id
left join public.fases fd on fd.id = e.fase_destino_id;