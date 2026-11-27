-- ============================================================================
-- PlanHub — Migration 38: fase final é imutável pela UI
--
-- Entrega aprovada ou entregue não muda de situação manualmente. A decisão
-- do cliente é final; voltar exige o fluxo próprio (novo link, recusa) —
-- que é o que registrar_aprovacao já controla.
-- ============================================================================

create or replace function public.alterar_fase_entrega(
  p_entrega_id bigint,
  p_fase_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_papel text;
  v_squad_usuario bigint;
  v_squad_entrega bigint;
  v_fase_antiga text;
  v_grupo_antigo text;
  v_fase_nova text;
  v_grupo_novo text;
  v_nome text;
  v_eh_responsavel boolean;
begin
  v_papel := public.papel_atual();
  if v_papel not in ('admin', 'gestor', 'operador') then
    raise exception 'Seu perfil só pode consultar.';
  end if;

  select f.codigo, f.grupo, e.squad_id
    into v_fase_antiga, v_grupo_antigo, v_squad_entrega
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  where e.id = p_entrega_id
  for update of e;

  if v_fase_antiga is null then
    raise exception 'Entrega não encontrada.';
  end if;

  -- Aprovação/entrega é estado final: não se muda manualmente.
  if v_grupo_antigo = 'final' then
    raise exception 'A entrega está em situação final (aprovada/entregue) e não pode mais ser alterada.';
  end if;

  -- Operador só muda a situação da entrega do próprio squad.
  if v_papel = 'operador' then
    select squad_id into v_squad_usuario from public.usuario
    where id = (select auth.uid()) and ativo;
    if v_squad_usuario is not null and v_squad_entrega is not null
       and v_squad_usuario <> v_squad_entrega then
      raise exception 'Esta entrega não é do seu squad.';
    end if;
  end if;

  select codigo, grupo into v_fase_nova, v_grupo_novo
  from public.fases where id = p_fase_id;
  if v_fase_nova is null then
    raise exception 'Situação inválida.';
  end if;

  select nome into v_nome from public.usuario
  where id = (select auth.uid());

  update public.entregas
  set fase_id = p_fase_id, atualizado_em = now()
  where id = p_entrega_id;

  insert into public.eventos_entrega
    (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
  values
    (p_entrega_id, 'fase', 'fase', v_fase_antiga, v_fase_nova, v_nome,
     public.id_origem('app'));

  return jsonb_build_object(
    'entrega_id', p_entrega_id,
    'fase', v_fase_nova,
    'anterior', v_fase_antiga
  );
end;
$fn$;

revoke all on function public.alterar_fase_entrega(bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.alterar_fase_entrega(bigint, bigint)
  to authenticated;