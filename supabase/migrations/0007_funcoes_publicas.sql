-- ============================================================================
-- Fase 3 — Migration 7: funções de aprovação expostas corretamente
--
-- A Data API do Supabase expõe apenas o schema `public`. As funções
-- SECURITY DEFINER das migrations 4 e 6 ficavam em `aprovacao_priv`, que não
-- é exposto — impossíveis de chamar pelo app. Elas se movem para `public`
-- mantendo a trava real de segurança:
--   - EXECUTE revogado de PUBLIC (o padrão do Postgres) e concedido
--     apenas ao service_role: só a rota de servidor do app as chama;
--   - o anon/authenticated continuam sem acesso à tabela de tokens
--     (schema não exposto + RLS sem políticas);
--   - as funções continuam SECURITY DEFINER com search_path fixado.
-- ============================================================================

create or replace function public.criar_token_aprovacao(
  p_entrega_id bigint,
  p_etapa etapa_aprovacao,
  p_validade_horas integer default 168
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_token text;
begin
  if p_validade_horas not between 1 and 24 * 30 then
    raise exception 'Validade do token deve ser entre 1 e 720 horas.';
  end if;

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

create or replace function public.registrar_aprovacao(
  p_token text,
  p_decisao text,
  p_autor_nome text,
  p_autor_email text default null,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_entrega_id bigint;
  v_etapa etapa_aprovacao;
  v_fase_atual fase_entrega;
  v_aprov_planej status_aprovacao;
  v_aprov_entrega status_aprovacao;
  v_decisao status_aprovacao;
  v_fase_nova fase_entrega;
  v_entrega public.entregas;
begin
  if p_autor_nome is null or btrim(p_autor_nome) = '' then
    raise exception 'Informe o nome de quem está aprovando.';
  end if;

  if p_decisao not in ('aprovada', 'aprovada_com_ressalvas', 'recusada') then
    raise exception 'Decisão inválida.';
  end if;
  v_decisao := p_decisao::status_aprovacao;

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.entrega_id, t.etapa
    into v_token_id, v_entrega_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash
    and t.expira_em > now()
    and t.usado_em is null
  for update of t;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select e.*
    into v_entrega
  from public.entregas e
  where e.id = v_entrega_id;
  v_fase_atual := v_entrega.fase;
  v_aprov_planej := v_entrega.aprovacao_planejamento;
  v_aprov_entrega := v_entrega.aprovacao_entrega;

  if v_etapa = 'planejamento' then
    v_aprov_planej := v_decisao;
    v_fase_nova := case
      when v_decisao = 'recusada' then 'ajuste_solicitado'::fase_entrega
      else 'em_producao'::fase_entrega
    end;
  else
    v_aprov_entrega := v_decisao;
    v_fase_nova := case
      when v_decisao = 'recusada' then 'ajuste_solicitado'::fase_entrega
      else 'aprovada'::fase_entrega
    end;
  end if;

  perform set_config('app.autor', 'Cliente via link: ' || p_autor_nome, true);

  update public.entregas
  set fase = v_fase_nova,
      aprovacao_planejamento = v_aprov_planej,
      aprovacao_entrega = v_aprov_entrega
  where id = v_entrega_id;

  insert into public.aprovacoes (entrega_id, etapa, decisao, autor_nome, autor_email, observacao, origem)
  values (v_entrega_id, v_etapa, v_decisao, btrim(p_autor_nome), p_autor_email, p_observacao, 'link');

  update aprovacao_priv.aprovacao_tokens
  set usado_em = now()
  where id = v_token_id;

  return jsonb_build_object(
    'entrega_id', v_entrega_id,
    'titulo', v_entrega.titulo,
    'tipo', v_entrega.tipo,
    'etapa', v_etapa,
    'decisao', v_decisao,
    'fase', v_fase_nova,
    'fase_anterior', v_fase_atual
  );
end;
$$;

create or replace function public.dados_entrega_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_etapa etapa_aprovacao;
  v_entrega public.entregas;
  v_cliente text;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.etapa
    into v_token_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash
    and t.expira_em > now()
    and t.usado_em is null;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select e.*
    into v_entrega
  from public.entregas e
  where e.id = (select entrega_id from aprovacao_priv.aprovacao_tokens where id = v_token_id);

  select c.nome
    into v_cliente
  from public.clientes c
  where c.id = v_entrega.cliente_id;

  return jsonb_build_object(
    'entrega_id', v_entrega.id,
    'titulo', v_entrega.titulo,
    'tipo', v_entrega.tipo,
    'cliente', v_cliente,
    'etapa', v_etapa,
    'data_prevista', v_entrega.data_prevista,
    'num_revisoes', v_entrega.num_revisoes,
    'aprovacao_planejamento', v_entrega.aprovacao_planejamento,
    'aprovacao_entrega', v_entrega.aprovacao_entrega
  );
end;
$$;

-- Contagem de links ativos para a tela da entrega (o time não vê o token).
create or replace function public.links_aprovacao_ativos(p_entrega_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_ativos integer;
  v_ultimo_expira timestamptz;
begin
  select count(*), max(expira_em)
    into v_ativos, v_ultimo_expira
  from aprovacao_priv.aprovacao_tokens
  where entrega_id = p_entrega_id
    and usado_em is null
    and expira_em > now();

  return jsonb_build_object('ativos', v_ativos, 'ultimo_expira_em', v_ultimo_expira);
end;
$$;

-- As versões antigas (schema privado) não são mais usadas.
drop function if exists aprovacao_priv.criar_token_aprovacao(bigint, etapa_aprovacao, integer);
drop function if exists aprovacao_priv.registrar_aprovacao(text, text, text, text, text);
drop function if exists aprovacao_priv.dados_entrega_por_token(text);

-- Trava de execução: apenas a rota de servidor (service_role).
-- ATENÇÃO: o Supabase concede EXECUTE por padrão direto a anon e
-- authenticated (ALTER DEFAULT PRIVILEGES) — revogar de PUBLIC não basta.
revoke all on function public.criar_token_aprovacao(bigint, etapa_aprovacao, integer) from public, anon, authenticated;
revoke all on function public.registrar_aprovacao(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.dados_entrega_por_token(text) from public, anon, authenticated;
revoke all on function public.links_aprovacao_ativos(bigint) from public, anon, authenticated;

grant execute on function public.criar_token_aprovacao(bigint, etapa_aprovacao, integer) to service_role;
grant execute on function public.registrar_aprovacao(text, text, text, text, text) to service_role;
grant execute on function public.dados_entrega_por_token(text) to service_role;
grant execute on function public.links_aprovacao_ativos(bigint) to service_role;
