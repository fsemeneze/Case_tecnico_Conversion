-- ============================================================================
-- PlanHub — Migration 29: preenchimento de link de entrega (D15)
--
-- As entregas com `link` nulo ou vazio (62 casos na base) entram na fila de
-- revisão. O time preenche o link real ou confirma que não tem arquivo — o
-- app nunca inventa um link.
--
-- A função aceita URL http/https ou a confirmação de ausência (nao_sei).
-- A preenchimento grava evento no histórico; a ausência registra confirmação
-- e deixa a flag `sem_link` visível até ser limpa por outro processo.
-- ============================================================================

create or replace function public.preencher_link_entrega(
  p_entrega_id bigint,
  p_link text default null,
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
  v_link_antigo text;
  v_autor uuid;
  v_nome text;
begin
  v_papel := public.papel_atual();
  if v_papel not in ('admin', 'gestor', 'operador') then
    raise exception 'Seu perfil não pode corrigir o link de entrega.';
  end if;

  if p_nao_sei and p_link is not null then
    raise exception 'Informe o link ou confirme que não tem.';
  end if;
  if not p_nao_sei and p_link is null then
    raise exception 'Informe o link de arquivo.';
  end if;
  if not p_nao_sei and p_link !~* '^https?://' then
    raise exception 'O link deve começar com http:// ou https://.';
  end if;

  select f.codigo, e.link
    into v_fase, v_link_antigo
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  where e.id = p_entrega_id
  for update of e;

  if v_fase is null then
    raise exception 'Entrega não encontrada.';
  end if;
  if v_link_antigo is not null then
    raise exception 'A entrega já tem link de arquivo registrado.';
  end if;

  select id, nome into v_autor, v_nome
  from public.usuario where id = (select auth.uid());

  if not p_nao_sei then
    update public.entregas
    set link = p_link,
        atualizado_em = now()
    where id = p_entrega_id;

    insert into public.eventos_entrega
      (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
    values
      (p_entrega_id, 'campo', 'link', null, p_link, v_nome, public.id_origem('app'));
  else
    insert into public.eventos_entrega
      (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
    values
      (p_entrega_id, 'campo', 'link', null,
       'confirmado sem link (não sei)', v_nome, public.id_origem('app'));
  end if;

  return jsonb_build_object(
    'entrega_id', p_entrega_id,
    'link', case when p_nao_sei then null else p_link end,
    'confirmado_sem_link', p_nao_sei
  );
end;
$fn$;

revoke all on function public.preencher_link_entrega(bigint, text, boolean)
  from public, anon, authenticated;
grant execute on function public.preencher_link_entrega(bigint, text, boolean)
  to authenticated;