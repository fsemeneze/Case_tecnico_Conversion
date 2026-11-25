-- ============================================================================
-- PlanOps — Migration 11: carga dos fatos
--
-- Migra entregas, eventos e aprovações do modelo antigo para o estrela.
-- A validação por contagem roda no final e bloqueia a migration 12
-- (remoção do modelo antigo) se algum número divergir.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- fato_entrega — 1.007 linhas, com as chaves das dimensões
-- ---------------------------------------------------------------------------

insert into public.fato_entrega (
  legacy_id, origem_id, cliente_id, tipo_entrega_id, squad_id, pessoa_id,
  fase_id, titulo,
  data_solicitacao_id, data_prevista_id, data_entrega_id,
  aprovacao_planejamento_id, aprovacao_entrega_id,
  num_revisoes, link, observacoes, flags, origem_linha
)
select
  e.legacy_id,
  (select id from public.dim_origem where codigo = 'planilha'),
  dc.id,
  dt.id,
  ds.id,
  dp.id,
  df.id,
  e.titulo,
  e.data_solicitacao,
  e.data_prevista,
  e.data_entrega,
  sap.id,
  sae.id,
  e.num_revisoes,
  e.link,
  e.observacoes,
  e.flags,
  e.origem_linha
from public.entregas e
join public.clientes c on c.id = e.cliente_id
join public.dim_cliente dc on dc.nome = c.nome
join public.dim_tipo_entrega dt
  on dt.tipo = e.tipo
 and (dt.subtipo = e.subtipo or (dt.subtipo is null and e.subtipo is null))
join public.dim_fase df on df.codigo = e.fase::text
join public.dim_status_aprovacao sap on sap.codigo = e.aprovacao_planejamento::text
join public.dim_status_aprovacao sae on sae.codigo = e.aprovacao_entrega::text
left join public.dim_squad ds on ds.nome = e.squad
left join public.dim_pessoa dp on dp.nome = e.responsavel;

-- ---------------------------------------------------------------------------
-- Validação por contagem — bloqueia a remoção do modelo antigo
-- ---------------------------------------------------------------------------

do $$
declare
  v_antigas integer;
  v_novas integer;
  v_clientes_antigos integer;
  v_clientes_novos integer;
  v_atraso_antigo integer;
  v_atraso_novo integer;
  v_vencidas_antigas integer;
  v_vencidas_novas integer;
begin
  select count(*) into v_antigas from public.entregas;
  select count(*) into v_novas from public.fato_entrega;

  select count(*) into v_clientes_antigos from public.clientes;
  select count(*) into v_clientes_novos from public.dim_cliente;

  select count(*) into v_atraso_antigo from public.entregas where dias_atraso > 0;
  select count(*) into v_atraso_novo from public.fato_entrega where dias_atraso > 0;

  select count(*) into v_vencidas_antigas
    from public.entregas
    where data_prevista < current_date
      and fase in ('solicitada','em_producao','aguardando_cliente',
                   'aguardando_aprovacao_entrega','ajuste_solicitado');

  select count(*) into v_vencidas_novas
    from public.fato_entrega f
    join public.dim_fase df on df.id = f.fase_id
    where f.data_prevista_id < current_date and df.grupo = 'aberta';

  if v_antigas <> v_novas then
    raise exception 'Entregas divergentes: antigas %, novas %', v_antigas, v_novas;
  end if;
  if v_clientes_antigos <> v_clientes_novos then
    raise exception 'Clientes divergentes: antigos %, novos %', v_clientes_antigos, v_clientes_novos;
  end if;
  if v_atraso_antigo <> v_atraso_novo then
    raise exception 'Atrasadas divergentes: antigas %, novas %', v_atraso_antigo, v_atraso_novo;
  end if;
  if v_vencidas_antigas <> v_vencidas_novas then
    raise exception 'Vencidas divergentes: antigas %, novas %', v_vencidas_antigas, v_vencidas_novas;
  end if;

  raise notice 'Carga validada: % entregas, % clientes, % atrasadas, % vencidas',
    v_novas, v_clientes_novos, v_atraso_novo, v_vencidas_novas;
end $$;