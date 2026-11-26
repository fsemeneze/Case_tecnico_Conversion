-- ============================================================================
-- PlanHub — Migration 23: pendências do portal ancoradas no link ativo
--
-- A migration 22 filtrava a pendência por fase ('aguardando_cliente' /
-- 'aguardando_aprovacao_entrega') e por aprovação 'pendente'. A base importada
-- não usa 'pendente' (as decisões antigas vêm como aprovada, nao_informado ou
-- nao_aplica), e a entrega criada no app nasce em 'solicitada'. Resultado: o
-- portal nunca listaria nada.
--
-- O sinal correto de "pronto para o cliente" é o link de aprovação ativo que o
-- time gerou. O portal lista e abre só o que o time colocou em aprovação, e a
-- função de emissão exige esse link ativo — o cliente não adianta a decisão.
-- ============================================================================

create or replace function public.dados_cliente_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_cliente_id bigint;
  v_cliente text;
  v_entregas jsonb;
  v_pendencias jsonb;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select cliente_id into v_cliente_id
  from aprovacao_priv.cliente_acessos
  where token_hash = v_hash and expira_em > now();

  if v_cliente_id is null then
    raise exception 'Link inválido ou expirado.';
  end if;

  select nome into v_cliente from public.clientes where id = v_cliente_id;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.data_prevista nulls last, x.id), '[]')
  into v_entregas
  from (
    select
      id, titulo, tipo, subtipo, fase, fase_rotulo, fase_grupo,
      data_prevista, data_entrega, dias_atraso, link,
      aprovacao_planejamento, aprovacao_entrega
    from public.entregas_detalhadas
    where cliente_id = v_cliente_id
  ) x;

  -- Pendente = decisão em aberto E link ativo gerado pelo time.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.data_prevista nulls last, p.entrega_id), '[]')
  into v_pendencias
  from (
    select e.id as entrega_id, e.titulo, 'planejamento'::text as etapa, e.data_prevista
    from public.entregas_detalhadas e
    where e.cliente_id = v_cliente_id
      and e.aprovacao_planejamento = 'pendente'
      and exists (
        select 1 from aprovacao_priv.aprovacao_tokens t
        where t.entrega_id = e.id
          and t.etapa::text = 'planejamento'
          and t.usado_em is null
          and t.expira_em > now()
      )
    union all
    select e.id as entrega_id, e.titulo, 'entrega'::text as etapa, e.data_prevista
    from public.entregas_detalhadas e
    where e.cliente_id = v_cliente_id
      and e.aprovacao_entrega = 'pendente'
      and exists (
        select 1 from aprovacao_priv.aprovacao_tokens t
        where t.entrega_id = e.id
          and t.etapa::text = 'entrega'
          and t.usado_em is null
          and t.expira_em > now()
      )
  ) p;

  return jsonb_build_object(
    'cliente', v_cliente,
    'entregas', v_entregas,
    'pendencias_aprovacao', v_pendencias
  );
end;
$$;

create or replace function public.criar_token_aprovacao_portal(
  p_portal_token text, p_entrega_id bigint, p_etapa text,
  p_validade_horas integer default 168
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_cliente_id bigint;
  v_pode boolean;
begin
  if p_etapa not in ('planejamento', 'entrega') then
    raise exception 'Etapa inválida.';
  end if;

  v_hash := encode(sha256(convert_to(p_portal_token, 'utf8')), 'hex');

  select cliente_id into v_cliente_id
  from aprovacao_priv.cliente_acessos
  where token_hash = v_hash and expira_em > now();

  if v_cliente_id is null then
    raise exception 'Link inválido ou expirado.';
  end if;

  -- A entrega é do cliente, a etapa está pendente e o time já gerou o link.
  select exists(
    select 1
    from public.entregas e
    join public.decisoes_aprovacao ap on ap.id = e.aprovacao_planejamento_id
    join public.decisoes_aprovacao ae on ae.id = e.aprovacao_entrega_id
    where e.id = p_entrega_id
      and e.cliente_id = v_cliente_id
      and (
        (p_etapa = 'planejamento' and ap.codigo = 'pendente')
        or (p_etapa = 'entrega' and ae.codigo = 'pendente')
      )
      and exists (
        select 1 from aprovacao_priv.aprovacao_tokens t
        where t.entrega_id = e.id
          and t.etapa::text = p_etapa
          and t.usado_em is null
          and t.expira_em > now()
      )
  ) into v_pode;

  if not v_pode then
    raise exception 'Esta entrega não está aguardando essa aprovação.';
  end if;

  return public.criar_token_aprovacao(p_entrega_id, p_etapa, p_validade_horas);
end;
$$;

revoke all on function public.dados_cliente_por_token(text) from public, anon, authenticated;
revoke all on function public.criar_token_aprovacao_portal(text, bigint, text, integer) from public, anon, authenticated;

grant execute on function public.dados_cliente_por_token(text) to service_role;
grant execute on function public.criar_token_aprovacao_portal(text, bigint, text, integer) to service_role;
