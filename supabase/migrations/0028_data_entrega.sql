-- ============================================================================
-- PlanHub — Migration 28: concluiu sem data de entrega (D14)
--
-- As entregas com status final e data_entrega em branco (flag
-- concluida_sem_data_entrega) entram na fila de revisão. O time preenche a
-- data real ou confirma "não sei" — o app nunca inventa a data.
--
-- A função só aceita data de entrega para entrega em fase final; o
-- preenchimento grava evento no histórico e recalcula as medidas na hora
-- (colunas geradas).
-- ============================================================================

create or replace function public.preencher_data_entrega(
  p_entrega_id bigint,
  p_data date,
  p_nao_sei boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_papel text;
  v_fase text;
  v_grupo text;
  v_autor uuid;
  v_nome text;
  v_antiga date;
begin
  v_papel := public.papel_atual();
  if v_papel not in ('admin', 'gestor', 'operador') then
    raise exception 'Seu perfil não pode corrigir a data de entrega.';
  end if;

  if p_nao_sei and p_data is not null then
    raise exception 'Informe a data ou confirme que não sabe.';
  end if;
  if not p_nao_sei and p_data is null then
    raise exception 'Informe a data de entrega.';
  end if;

  select f.codigo, f.grupo, e.data_entrega_id
    into v_fase, v_grupo, v_antiga
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  where e.id = p_entrega_id
  for update of e;

  if v_fase is null then
    raise exception 'Entrega não encontrada.';
  end if;
  if v_grupo <> 'final' then
    raise exception 'A entrega não está em fase final.';
  end if;
  if v_antiga is not null then
    raise exception 'A entrega já tem data de entrega registrada.';
  end if;

  select id, nome into v_autor, v_nome
  from public.usuario where id = (select auth.uid());

  if not p_nao_sei then
    update public.entregas
    set data_entrega_id = p_data,
        atualizado_em = now()
    where id = p_entrega_id;

    insert into public.eventos_entrega
      (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
    values
      (p_entrega_id, 'campo', 'data_entrega', null, p_data::text, v_nome,
       public.id_origem('app'));
  else
    -- "Não sei": a flag permanece; registramos a confirmação como evento.
    insert into public.eventos_entrega
      (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
    values
      (p_entrega_id, 'campo', 'data_entrega', null,
       'confirmado sem data (não sei)', v_nome, public.id_origem('app'));
  end if;

  return jsonb_build_object(
    'entrega_id', p_entrega_id,
    'data_entrega', case when p_nao_sei then null else p_data end,
    'confirmado_sem_data', p_nao_sei
  );
end;
$fn$;

revoke all on function public.preencher_data_entrega(bigint, date, boolean)
  from public, anon, authenticated;
grant execute on function public.preencher_data_entrega(bigint, date, boolean)
  to authenticated;