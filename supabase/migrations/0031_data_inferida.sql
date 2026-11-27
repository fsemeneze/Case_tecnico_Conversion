-- ============================================================================
-- PlanHub — Migration 31: confirmar data com ano inferido (D17)
--
-- 40 entregas têm data curta ("10/nov") sem ano; o normalizador inferiu o ano
-- pela data mais próxima (D5) e marcou a flag. A fila de revisão passa a
-- mostrar a data inferida e permite confirmar (mantém) ou corrigir.
--
-- A função só grava datas de solicitação, prevista ou entrega — nunca inventa
-- valor: o time confirma ou troca.
-- ============================================================================

create or replace function public.confirmar_data_inferida(
  p_entrega_id bigint,
  p_campo text,
  p_data date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_papel text;
  v_fase text;
  v_antiga date;
  v_nome text;
  v_coluna text;
begin
  v_papel := public.papel_atual();
  if v_papel not in ('admin', 'gestor', 'operador') then
    raise exception 'Seu perfil não pode corrigir datas.';
  end if;

  if p_campo not in ('data_solicitacao', 'data_prevista', 'data_entrega') then
    raise exception 'Campo de data inválido.';
  end if;
  if p_data is null then
    raise exception 'Informe a data.';
  end if;

  select f.codigo into v_fase
  from public.entregas e join public.fases f on f.id = e.fase_id
  where e.id = p_entrega_id;

  if v_fase is null then
    raise exception 'Entrega não encontrada.';
  end if;

  select nome into v_nome from public.usuario where id = (select auth.uid());

  if p_campo = 'data_solicitacao' then
    select data_solicitacao_id into v_antiga from public.entregas where id = p_entrega_id;
    update public.entregas set data_solicitacao_id = p_data, atualizado_em = now() where id = p_entrega_id;
  elsif p_campo = 'data_prevista' then
    select data_prevista_id into v_antiga from public.entregas where id = p_entrega_id;
    update public.entregas set data_prevista_id = p_data, atualizado_em = now() where id = p_entrega_id;
  else
    select data_entrega_id into v_antiga from public.entregas where id = p_entrega_id;
    update public.entregas set data_entrega_id = p_data, atualizado_em = now() where id = p_entrega_id;
  end if;

  insert into public.eventos_entrega
    (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
  values
    (p_entrega_id, 'campo', p_campo, v_antiga::text, p_data::text, v_nome,
     public.id_origem('app'));

  return jsonb_build_object(
    'entrega_id', p_entrega_id,
    'campo', p_campo,
    'data', p_data,
    'anterior', v_antiga
  );
end;
$fn$;

revoke all on function public.confirmar_data_inferida(bigint, text, date)
  from public, anon, authenticated;
grant execute on function public.confirmar_data_inferida(bigint, text, date)
  to authenticated;