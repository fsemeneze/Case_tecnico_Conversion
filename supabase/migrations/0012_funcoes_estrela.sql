-- ============================================================================
-- PlanOps — Migration 12: funções no modelo estrela
--
-- Substituem as funções da migration 7. Todas em `public` (único schema
-- exposto pela Data API), SECURITY DEFINER, com EXECUTE só do service_role.
-- As tabelas de token continuam no schema privado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares de resolução de dimensão
-- ---------------------------------------------------------------------------

create or replace function public.dim_fase_id(p_codigo text)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$ select id from public.dim_fase where codigo = p_codigo; $$;

create or replace function public.dim_status_id(p_codigo text)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$ select id from public.dim_status_aprovacao where codigo = p_codigo; $$;

create or replace function public.dim_etapa_id(p_codigo text)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$ select id from public.dim_etapa_aprovacao where codigo = p_codigo; $$;

create or replace function public.dim_origem_id(p_codigo text)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$ select id from public.dim_origem where codigo = p_codigo; $$;

-- Data opcional -> id da dim_data (null quando a data é nula)
create or replace function public.dim_data_id(p_data date)
returns date
language sql
immutable
security invoker
set search_path = public
as $$ select p_data; $$;

-- ---------------------------------------------------------------------------
-- Geração de token de aprovação
-- ---------------------------------------------------------------------------

create or replace function public.criar_token_aprovacao(
  p_entrega_id bigint,
  p_etapa text,
  p_validade_horas integer default 168
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_token text;
  v_etapa_id bigint;
begin
  if p_validade_horas not between 1 and 24 * 30 then
    raise exception 'Validade do token deve ser entre 1 e 720 horas.';
  end if;

  v_etapa_id := public.dim_etapa_id(p_etapa);
  if v_etapa_id is null then
    raise exception 'Etapa inválida.';
  end if;

  if not exists (select 1 from public.fato_entrega where id = p_entrega_id) then
    raise exception 'Entrega não encontrada.';
  end if;

  v_token := gen_random_uuid()::text;

  insert into aprovacao_priv.aprovacao_tokens (token_hash, entrega_id, etapa, expira_em)
  values (
    encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
    p_entrega_id,
    p_etapa::aprovacao_priv.etapa_token,
    now() + make_interval(hours => p_validade_horas)
  );

  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Registro da aprovação (página pública, sem login)
-- ---------------------------------------------------------------------------

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
  v_etapa text;
  v_fase_atual text;
  v_decisao_id bigint;
  v_fase_nova text;
  v_titulo text;
  v_tipo text;
  v_solicitacao date;
begin
  if p_autor_nome is null or btrim(p_autor_nome) = '' then
    raise exception 'Informe o nome de quem está aprovando.';
  end if;

  if p_decisao not in ('aprovada', 'aprovada_com_ressalvas', 'recusada') then
    raise exception 'Decisão inválida.';
  end if;
  v_decisao_id := public.dim_status_id(p_decisao);

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  -- Lock na linha do token: uso único mesmo em chamadas concorrentes.
  select t.id, t.entrega_id, t.etapa::text
    into v_token_id, v_entrega_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash
    and t.expira_em > now()
    and t.usado_em is null
  for update of t;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select titulo, fase::text, data_solicitacao_id
    into v_titulo, v_fase_atual, v_solicitacao
  from public.fato_entrega where id = v_entrega_id;

  -- Transição de fase por etapa (D2/D3).
  if v_etapa = 'planejamento' then
    v_fase_nova := case when v_decisao = 'recusada' then 'ajuste_solicitado' else 'em_producao' end;
    update public.fato_entrega
    set fase_id = public.dim_fase_id(v_fase_nova),
        aprovacao_planejamento_id = v_decisao_id
    where id = v_entrega_id;
  else
    v_fase_nova := case when v_decisao = 'recusada' then 'ajuste_solicitado' else 'aprovada' end;
    update public.fato_entrega
    set fase_id = public.dim_fase_id(v_fase_nova),
        aprovacao_entrega_id = v_decisao_id
    where id = v_entrega_id;
  end if;

  -- Fato de aprovação (grão: decisão por etapa).
  insert into public.fato_aprovacao
    (entrega_id, etapa_id, decisao_id, autor_nome, autor_email, observacao,
     origem_id, data_solicitacao, data_decisao, dias_ate_decisao)
  values (
    v_entrega_id,
    public.dim_etapa_id(v_etapa),
    v_decisao_id,
    btrim(p_autor_nome),
    p_autor_email,
    p_observacao,
    public.dim_origem_id('app'),
    v_solicitacao,
    now(),
    case when v_solicitacao is null then null else now()::date - v_solicitacao end
  );

  -- Evento de transição de fase.
  insert into public.fato_evento_entrega
    (entrega_id, tipo_evento, campo, valor_antigo, valor_novo,
     fase_origem_id, fase_destino_id, autor, origem_id)
  values (
    v_entrega_id, 'fase', 'fase', v_fase_atual, v_fase_nova,
    public.dim_fase_id(v_fase_atual), public.dim_fase_id(v_fase_nova),
    'Cliente via link: ' || btrim(p_autor_nome),
    public.dim_origem_id('app')
  );

  update aprovacao_priv.aprovacao_tokens
  set usado_em = now()
  where id = v_token_id;

  return jsonb_build_object(
    'entrega_id', v_entrega_id,
    'titulo', v_titulo,
    'etapa', v_etapa,
    'decisao', p_decisao,
    'fase', v_fase_nova,
    'fase_anterior', v_fase_atual
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados da entrega pendente, resolvidos pelo token
-- ---------------------------------------------------------------------------

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
  v_entrega public.vw_entregas;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.etapa::text
    into v_token_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash
    and t.expira_em > now()
    and t.usado_em is null;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select * into v_entrega
  from public.vw_entregas
  where id = (select entrega_id from aprovacao_priv.aprovacao_tokens where id = v_token_id);

  return jsonb_build_object(
    'entrega_id', v_entrega.id,
    'titulo', v_entrega.titulo,
    'tipo', v_entrega.tipo,
    'cliente', v_entrega.cliente,
    'etapa', v_etapa,
    'data_prevista', v_entrega.data_prevista,
    'num_revisoes', v_entrega.num_revisoes,
    'aprovacao_planejamento', v_entrega.aprovacao_planejamento,
    'aprovacao_entrega', v_entrega.aprovacao_entrega
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Contagem de links ativos (o time não vê o token)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Trava de execução: só a rota de servidor (service_role).
-- O Supabase concede EXECUTE direto a anon/authenticated por default
-- privileges — revogar de PUBLIC não basta.
-- ---------------------------------------------------------------------------

revoke all on function public.criar_token_aprovacao(bigint, text, integer) from public, anon, authenticated;
revoke all on function public.registrar_aprovacao(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.dados_entrega_por_token(text) from public, anon, authenticated;
revoke all on function public.links_aprovacao_ativos(bigint) from public, anon, authenticated;
revoke all on function public.dim_fase_id(text) from public, anon;
revoke all on function public.dim_status_id(text) from public, anon;
revoke all on function public.dim_etapa_id(text) from public, anon;
revoke all on function public.dim_origem_id(text) from public, anon;

grant execute on function public.criar_token_aprovacao(bigint, text, integer) to service_role;
grant execute on function public.registrar_aprovacao(text, text, text, text, text) to service_role;
grant execute on function public.dados_entrega_por_token(text) to service_role;
grant execute on function public.links_aprovacao_ativos(bigint) to service_role;