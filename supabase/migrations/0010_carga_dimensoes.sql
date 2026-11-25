-- ============================================================================
-- PlanOps — Migration 10: carga das dimensões
--
-- Preenche as dimensões a partir do modelo antigo. Os IDs são determinísticos
-- (a ordem de inserção define o id), o que permite que a migration 11
-- migre os fatos por junção sem depender de nomes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- dim_fase — 8 fases, em ordem de processo. IDs 1..8.
-- Grupo: 1..5 abertas, 6..7 finais, 8 cancelada.
-- ---------------------------------------------------------------------------

insert into public.dim_fase (codigo, rotulo, grupo, ordem, descricao) values
  ('solicitada',                  'Solicitada',                    'aberta',    1, 'Pedido recebido, ainda sem produção'),
  ('em_producao',                 'Em produção',                   'aberta',    2, 'Em execução pelo squad'),
  ('aguardando_cliente',          'Aguardando o cliente',          'aberta',    3, 'Depende de retorno do cliente'),
  ('aguardando_aprovacao_entrega','Aguardando aprovação da entrega','aberta',   4, 'Entregue, aguardando decisão do cliente'),
  ('ajuste_solicitado',           'Ajuste solicitado',             'aberta',    5, 'Cliente pediu mudanças'),
  ('entregue',                    'Entregue',                      'final',     6, 'Concluída, sem aprovação registrada'),
  ('aprovada',                    'Aprovada',                      'final',     7, 'Aprovada pelo cliente'),
  ('cancelada',                   'Cancelada',                     'cancelada', 8, 'Cancelada ou suspensa');

-- ---------------------------------------------------------------------------
-- dim_status_aprovacao — 6 decisões. IDs 1..6.
-- ---------------------------------------------------------------------------

insert into public.dim_status_aprovacao (codigo, rotulo, conclusiva) values
  ('pendente',              'Pendente',              false),
  ('aprovada',              'Aprovada',              true),
  ('aprovada_com_ressalvas','Aprovada com ressalvas', true),
  ('recusada',              'Recusada',              true),
  ('nao_aplica',            'Não se aplica',         false),
  ('nao_informado',         'Não informado',         false);

-- ---------------------------------------------------------------------------
-- dim_etapa_aprovacao — 2 etapas. IDs 1..2.
-- ---------------------------------------------------------------------------

insert into public.dim_etapa_aprovacao (codigo, rotulo, ordem) values
  ('planejamento', 'Planejamento', 1),
  ('entrega',      'Entrega',      2);

-- ---------------------------------------------------------------------------
-- dim_origem — 3 origens. IDs 1..3.
-- ---------------------------------------------------------------------------

insert into public.dim_origem (codigo, rotulo) values
  ('planilha',    'Planilha (importação)'),
  ('app',         'App (cadastro manual)'),
  ('importacao',  'Importação');

-- ---------------------------------------------------------------------------
-- dim_data — calendário de 2024-01-01 a 2028-12-31 (5 anos)
-- ---------------------------------------------------------------------------

insert into public.dim_data (
  id, ano, semestre, trimestre, mes, nome_mes, dia,
  dia_semana, nome_dia_semana, semana_ano, eh_dia_util, eh_fim_de_semana
)
select
  d::date,
  extract(year from d)::smallint,
  case when extract(month from d) <= 6 then 1 else 2 end::smallint,
  extract(quarter from d)::smallint,
  extract(month from d)::smallint,
  to_char(d, 'TMMonth'),
  extract(day from d)::smallint,
  extract(isodow from d)::smallint,
  to_char(d, 'TMDay'),
  extract(week from d)::smallint,
  extract(isodow from d) < 6,
  extract(isodow from d) >= 6
from generate_series('2024-01-01'::date, '2028-12-31'::date, interval '1 day') as d;