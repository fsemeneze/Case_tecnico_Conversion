-- ============================================================================
-- PlanHub — Migration 37: estado do token para a página de aprovação
--
-- Quando o cliente recarrega um link já usado, a página deve dizer "sua
-- solicitação foi registrada" em vez de erro. Esta função devolve o estado
-- do token (usado / expirado / inexistente) e a decisão registrada.
-- ============================================================================

create or replace function public.estado_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $fn$
declare
  v_hash text;
  v_usado timestamptz;
  v_expira timestamptz;
  v_etapa text;
  v_entrega_id bigint;
  v_titulo text;
  v_decisao text;
  v_autor text;
  v_quando timestamptz;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.usado_em, t.expira_em, t.etapa::text, t.entrega_id
    into v_usado, v_expira, v_etapa, v_entrega_id
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash;

  if v_entrega_id is null then
    return jsonb_build_object('status', 'invalido');
  end if;

  select titulo into v_titulo from public.entregas where id = v_entrega_id;

  if v_usado is not null then
    -- Decisão registrada no instante do uso (mesma entrega/etapa).
    select da.rotulo, ap.autor_nome, ap.data_decisao
      into v_decisao, v_autor, v_quando
    from public.aprovacoes ap
    join public.decisoes_aprovacao da on da.id = ap.decisao_id
    where ap.entrega_id = v_entrega_id
      and ap.etapa_id = (select id from public.etapas_aprovacao where codigo = v_etapa)
      and ap.data_decisao between v_usado - interval '1 minute'
                              and v_usado + interval '1 minute'
    order by ap.data_decisao desc
    limit 1;

    return jsonb_build_object(
      'status', 'usado',
      'titulo', v_titulo,
      'etapa', v_etapa,
      'decisao', coalesce(v_decisao, 'registrada'),
      'autor', v_autor,
      'quando', v_quando
    );
  end if;

  if v_expira <= now() then
    return jsonb_build_object('status', 'expirado', 'titulo', v_titulo, 'etapa', v_etapa);
  end if;

  return jsonb_build_object('status', 'invalido');
end;
$fn$;

revoke all on function public.estado_token(text) from public, anon, authenticated;
grant execute on function public.estado_token(text) to service_role;