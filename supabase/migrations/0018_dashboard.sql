-- ============================================================================
-- PlanHub — Migration 18: agregados do dashboard
--
-- O PostgREST limita a 1000 linhas por consulta; somar no app a partir de
-- entregas_detalhadas truncava os agregados. Esta função (security invoker,
-- RLS por papel) calcula tudo no banco e devolve um JSON.
-- ============================================================================

create or replace function public.dashboard_resumo()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with base as (
  select
    e.id, e.tipo_entrega_id, e.cliente_id, e.fase_id,
    e.data_prevista_id, e.data_entrega_id,
    f.grupo as fase_grupo,
    (e.data_entrega_id > e.data_prevista_id) as atrasou_entregue,
    (f.grupo = 'aberta' and e.data_prevista_id is not null and e.data_prevista_id < current_date) as vencida_aberta
  from public.entregas e
  join public.fases f on f.id = e.fase_id
),
marcado as (
  select b.*, (b.atrasou_entregue or b.vencida_aberta) as atrasada
  from base b
)
select jsonb_build_object(
  'total', (select count(*) from marcado),
  'comparaveis', (select count(*) from marcado where data_prevista_id is not null and (data_entrega_id is not null or fase_grupo = 'aberta')),
  'atrasadas', (select count(*) from marcado where atrasada),
  'por_tipo', (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]')
    from (
      select te.tipo, count(*) as total, count(*) filter (where m.atrasada) as atrasadas
      from marcado m join public.tipos_entrega te on te.id = m.tipo_entrega_id
      group by te.tipo
    ) t
  ),
  'por_fase', (
    select coalesce(jsonb_agg(to_jsonb(f) order by f.total desc), '[]')
    from (
      select f.codigo as fase, f.rotulo, count(*) as total
      from marcado m join public.fases f on f.id = m.fase_id
      group by f.codigo, f.rotulo
    ) f
  ),
  'top_clientes', (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.atrasadas desc), '[]')
    from (
      select cl.nome as cliente, count(*) filter (where m.atrasada) as atrasadas
      from marcado m join public.clientes cl on cl.id = m.cliente_id
      group by cl.nome
      having count(*) filter (where m.atrasada) > 0
      order by atrasadas desc
      limit 5
    ) c
  )
);
$$;

revoke all on function public.dashboard_resumo() from public, anon;
grant execute on function public.dashboard_resumo() to authenticated, service_role;