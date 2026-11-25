-- ============================================================================
-- PlanOps — Migration 24: corrige o cast de etapa em criar_token_aprovacao
--
-- A coluna aprovacao_priv.aprovacao_tokens.etapa é `text`, não o enum
-- `aprovacao_priv.etapa_token`. A migration 22 comparava a coluna com o cast
-- do enum e quebrava a geração de link ("operator does not exist: text =
-- etapa_token"). Aqui a comparação passa a ser texto x texto.
-- ============================================================================

create or replace function public.criar_token_aprovacao(
  p_entrega_id bigint, p_etapa text, p_validade_horas integer default 168
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare v_token text;
begin
  if p_validade_horas not between 1 and 24 * 30 then
    raise exception 'Validade do token deve ser entre 1 e 720 horas.';
  end if;
  if p_etapa not in ('planejamento', 'entrega') then
    raise exception 'Etapa inválida.';
  end if;
  if not exists (select 1 from public.entregas where id = p_entrega_id) then
    raise exception 'Entrega não encontrada.';
  end if;

  -- Um link novo substitui o anterior: quem tem o link velho perde o acesso.
  update aprovacao_priv.aprovacao_tokens
  set expira_em = now()
  where entrega_id = p_entrega_id
    and etapa = p_etapa
    and usado_em is null
    and expira_em > now();

  v_token := gen_random_uuid()::text;
  insert into aprovacao_priv.aprovacao_tokens (token_hash, entrega_id, etapa, expira_em)
  values (
    encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
    p_entrega_id,
    p_etapa,
    now() + make_interval(hours => p_validade_horas)
  );
  return v_token;
end;
$$;

revoke all on function public.criar_token_aprovacao(bigint, text, integer) from public, anon, authenticated;
grant execute on function public.criar_token_aprovacao(bigint, text, integer) to service_role;
