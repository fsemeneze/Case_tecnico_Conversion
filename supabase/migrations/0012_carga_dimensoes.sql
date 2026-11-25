-- ============================================================================
-- PlanOps — Migration 12: carga das dimensões
--
-- Os IDs são determinísticos (a ordem de inserção define o id), o que permite
-- que a migration 13 migre os fatos por junção sem depender de nomes.
-- ============================================================================

-- Fases: 8, em ordem de processo. IDs 1..8.
-- Grupo: 1..5 abertas, 6..7 finais, 8 cancelada.
insert into public.fases (codigo, rotulo, grupo, ordem, descricao) values
  ('solicitada',                  'Solicitada',                    'aberta',    1, 'Pedido recebido, ainda sem produção'),
  ('em_producao',                 'Em produção',                   'aberta',    2, 'Em execução pelo squad'),
  ('aguardando_cliente',          'Aguardando o cliente',          'aberta',    3, 'Depende de retorno do cliente'),
  ('aguardando_aprovacao_entrega','Aguardando aprovação da entrega','aberta',   4, 'Entregue, aguardando decisão do cliente'),
  ('ajuste_solicitado',           'Ajuste solicitado',             'aberta',    5, 'Cliente pediu mudanças'),
  ('entregue',                    'Entregue',                      'final',     6, 'Concluída, sem aprovação registrada'),
  ('aprovada',                    'Aprovada',                      'final',     7, 'Aprovada pelo cliente'),
  ('cancelada',                   'Cancelada',                     'cancelada', 8, 'Cancelada ou suspensa');

-- Decisões de aprovação: 6. IDs 1..6.
insert into public.decisoes_aprovacao (codigo, rotulo, conclusiva) values
  ('pendente',              'Pendente',              false),
  ('aprovada',              'Aprovada',              true),
  ('aprovada_com_ressalvas','Aprovada com ressalvas', true),
  ('recusada',              'Recusada',              true),
  ('nao_aplica',            'Não se aplica',         false),
  ('nao_informado',         'Não informado',         false);

-- Etapas: 2. IDs 1..2.
insert into public.etapas_aprovacao (codigo, rotulo, ordem) values
  ('planejamento', 'Planejamento', 1),
  ('entrega',      'Entrega',      2);

-- Origens: 3. IDs 1..3.
insert into public.origens (codigo, rotulo) values
  ('planilha',    'Planilha (importação)'),
  ('app',         'App (cadastro manual)'),
  ('importacao',  'Importação');

-- Calendário de 2024-01-01 a 2028-12-31 (5 anos).
insert into public.calendario (
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