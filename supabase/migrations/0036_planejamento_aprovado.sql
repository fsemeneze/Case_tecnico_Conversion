-- ============================================================================
-- PlanHub — Migration 36: entrega aprovada implica planejamento aprovado
--
-- Regra de padronização: se a entrega foi aprovada (fase aprovada ou
-- aprovação de entrega aprovada/com ressalvas), o planejamento é tratado como
-- aprovado — o cliente não pode ter reprovado o planejamento e aprovado a
-- entrega final sem que o planejamento tenha sido resolvido.
--
-- Exceções preservadas:
--   - "nao_aplica" (D6): relatório não tem planejamento — não vira aprovado.
--   - "recusada": decisão real registrada; o histórico guarda a recusa.
-- ============================================================================

update public.entregas e
set aprovacao_planejamento_id = (
      select id from public.decisoes_aprovacao where codigo = 'aprovada'
    ),
    atualizado_em = now()
where e.aprovacao_planejamento_id in (
        select id from public.decisoes_aprovacao where codigo = 'nao_informado'
      )
  and (
    e.fase_id = (select id from public.fases where codigo = 'aprovada')
    or e.aprovacao_entrega_id in (
      select id from public.decisoes_aprovacao
      where codigo in ('aprovada', 'aprovada_com_ressalvas')
    )
  );

-- Mantém a regra para as próximas atualizações (aprovação pelo link, edição).
create or replace function public.padronizar_planejamento()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
begin
  if new.aprovacao_planejamento_id in (
      select id from public.decisoes_aprovacao where codigo = 'nao_informado'
    )
    and (
      new.fase_id = (select id from public.fases where codigo = 'aprovada')
      or new.aprovacao_entrega_id in (
        select id from public.decisoes_aprovacao
        where codigo in ('aprovada', 'aprovada_com_ressalvas')
      )
    )
  then
    new.aprovacao_planejamento_id := (
      select id from public.decisoes_aprovacao where codigo = 'aprovada'
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists entregas_padronizar_planejamento on public.entregas;
create trigger entregas_padronizar_planejamento
  before insert or update on public.entregas
  for each row execute function public.padronizar_planejamento();