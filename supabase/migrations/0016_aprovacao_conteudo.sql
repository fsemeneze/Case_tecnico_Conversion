-- ============================================================================
-- PlanHub — Migration 16: conteúdo da entrega na aprovação
--
-- A página pública do cliente precisa mostrar o que está sendo aprovado, não só
-- os metadados. `dados_entrega_por_token` passa a devolver também o `link` da
-- entrega (a URL do conteúdo). Mantém o resto igual.
-- ============================================================================

create or replace function public.dados_entrega_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_etapa text;
  v_entrega public.entregas_detalhadas;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.etapa::text into v_token_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash and t.expira_em > now() and t.usado_em is null;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select * into v_entrega from public.entregas_detalhadas
  where id = (select entrega_id from aprovacao_priv.aprovacao_tokens where id = v_token_id);

  return jsonb_build_object(
    'entrega_id', v_entrega.id, 'titulo', v_entrega.titulo, 'tipo', v_entrega.tipo,
    'cliente', v_entrega.cliente, 'etapa', v_etapa, 'data_prevista', v_entrega.data_prevista,
    'num_revisoes', v_entrega.num_revisoes, 'link', v_entrega.link,
    'aprovacao_planejamento', v_entrega.aprovacao_planejamento,
    'aprovacao_entrega', v_entrega.aprovacao_entrega
  );
end;
$$;

revoke all on function public.dados_entrega_por_token(text) from public, anon, authenticated;
grant execute on function public.dados_entrega_por_token(text) to service_role;