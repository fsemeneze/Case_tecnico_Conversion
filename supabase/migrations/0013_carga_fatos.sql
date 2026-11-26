-- ============================================================================
-- PlanHub — Migration 13: carga dos fatos
--
-- Migra entregas, eventos e aprovações do modelo antigo para o estrela.
-- A validação por contagem roda no final e bloqueia a migration 14
-- (RLS) se algum número divergir.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- O modelo antigo fica de lado, renomeado, até a carga validar as contagens.
-- A migration 15 remove as tabelas *_antigo.
-- ---------------------------------------------------------------------------

alter table public.clientes rename to clientes_antigo;
alter table public.entregas rename to entregas_antigo;
alter table public.erros_importacao rename to erros_antigo;

-- Clientes e grafias
insert into public.clientes (nome)
select nome from public.clientes_antigo order by nome;

insert into public.aliases_cliente (cliente_id, grafia)
select c.id, a.nome
from public.clientes_antigo a
join public.clientes c on c.nome = a.nome;

-- Pessoas, squads e tipos
insert into public.pessoas (nome)
select distinct responsavel from public.entregas_antigo
where responsavel is not null and responsavel <> ''
on conflict (nome) do nothing;

insert into public.squads (nome)
select distinct squad from public.entregas_antigo
where squad is not null and squad <> ''
on conflict (nome) do nothing;

insert into public.tipos_entrega (tipo, subtipo)
select distinct tipo, subtipo from public.entregas_antigo
on conflict (tipo, subtipo) do nothing;

-- Entregas
insert into public.entregas (
  legacy_id, origem_id, cliente_id, tipo_entrega_id, squad_id, pessoa_id,
  fase_id, titulo,
  data_solicitacao_id, data_prevista_id, data_entrega_id,
  aprovacao_planejamento_id, aprovacao_entrega_id,
  num_revisoes, link, observacoes, flags, origem_linha
)
select
  e.legacy_id,
  (select id from public.origens where codigo = 'planilha'),
  c.id,
  t.id,
  s.id,
  p.id,
  f.id,
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
from public.entregas_antigo e
join public.clientes_antigo ca on ca.id = e.cliente_id
join public.clientes c on c.nome = ca.nome
join public.tipos_entrega t
  on t.tipo = e.tipo
 and (t.subtipo = e.subtipo or (t.subtipo is null and e.subtipo is null))
join public.fases f on f.codigo = e.fase::text
join public.decisoes_aprovacao sap on sap.codigo = e.aprovacao_planejamento::text
join public.decisoes_aprovacao sae on sae.codigo = e.aprovacao_entrega::text
left join public.squads s on s.nome = e.squad
left join public.pessoas p on p.nome = e.responsavel;

-- Eventos: uma linha por entrega importada (estado inicial)
insert into public.eventos_entrega
  (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id, criado_em)
select
  e.id, 'importacao', null, null, f.codigo,
  'Importação da planilha',
  (select id from public.origens where codigo = 'importacao'),
  e.criado_em
from public.entregas e
join public.fases f on f.id = e.fase_id;

-- Aprovações: recria a partir das colunas de decisão
insert into public.aprovacoes
  (entrega_id, etapa_id, decisao_id, autor_nome, autor_email, observacao,
   origem_id, data_solicitacao, data_decisao, dias_ate_decisao)
select
  e.id,
  et.id,
  d.id,
  'Registro da planilha',
  null,
  null,
  (select id from public.origens where codigo = 'importacao'),
  e.data_solicitacao_id,
  coalesce(e.data_entrega_id, e.data_prevista_id, e.data_solicitacao_id, current_date)::timestamptz,
  case
    when e.data_solicitacao_id is null then null
    else coalesce(e.data_entrega_id, e.data_prevista_id, current_date) - e.data_solicitacao_id
  end
from public.entregas e
join public.etapas_aprovacao et on et.codigo = 'entrega'
join public.decisoes_aprovacao d on d.id = e.aprovacao_entrega_id
where d.codigo in ('aprovada', 'aprovada_com_ressalvas', 'recusada');

-- Fila de revisão
insert into public.erros_importacao
  (entrega_id, legacy_id, codigo, severidade, detalhe, origem_linha, resolvido, criado_em)
select
  e.id, ea.legacy_id, ea.codigo, ea.severidade::text, ea.detalhe, ea.origem_linha,
  ea.resolvido, ea.criado_em
from public.erros_antigo ea
left join public.entregas e on e.legacy_id = ea.legacy_id;

-- ---------------------------------------------------------------------------
-- Validação por contagem — bloqueia a RLS se algum número divergir
-- ---------------------------------------------------------------------------

do $$
declare
  v_antigas integer;
  v_novas integer;
  v_atraso_antigo integer;
  v_atraso_novo integer;
  v_vencidas_antigas integer;
  v_vencidas_novas integer;
begin
  select count(*) into v_antigas from public.entregas_antigo;
  select count(*) into v_novas from public.entregas;

  select count(*) into v_atraso_antigo from public.entregas_antigo where dias_atraso > 0;
  select count(*) into v_atraso_novo from public.entregas where dias_atraso > 0;

  select count(*) into v_vencidas_antigas
    from public.entregas_antigo
    where data_prevista < current_date
      and fase in ('solicitada','em_producao','aguardando_cliente',
                   'aguardando_aprovacao_entrega','ajuste_solicitado');

  select count(*) into v_vencidas_novas
    from public.entregas e
    join public.fases f on f.id = e.fase_id
    where e.data_prevista_id < current_date and f.grupo = 'aberta';

  if v_antigas <> v_novas then
    raise exception 'Entregas divergentes: antigas %, novas %', v_antigas, v_novas;
  end if;
  if v_atraso_antigo <> v_atraso_novo then
    raise exception 'Atrasadas divergentes: antigas %, novas %', v_atraso_antigo, v_atraso_novo;
  end if;
  if v_vencidas_antigas <> v_vencidas_novas then
    raise exception 'Vencidas divergentes: antigas %, novas %', v_vencidas_antigas, v_vencidas_novas;
  end if;

  raise notice 'Carga validada: % entregas, % atrasadas, % vencidas',
    v_novas, v_atraso_novo, v_vencidas_novas;
end $$;