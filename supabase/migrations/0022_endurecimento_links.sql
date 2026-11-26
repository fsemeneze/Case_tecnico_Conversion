-- ============================================================================
-- PlanHub — Migration 22: endurecimento do acesso do cliente por link
--
-- Mantém a decisão D3 (cliente sem conta) e fecha quatro lacunas:
--   1. E-mail obrigatório na aprovação (rastreabilidade).
--   2. Registro de IP e user-agent de quem aprova.
--   3. Link novo invalida o anterior (aprovação por entrega+etapa e portal
--      por cliente), em vez de deixar dois links válidos ao mesmo tempo.
--   4. O portal lista as aprovações pendentes e abre o link de aprovação sem
--      depender do time gerar e reenviar um link.
--
-- Segurança preservada: funções SECURITY DEFINER, EXECUTE só para o
-- service_role, token guardado apenas como sha256, escopo mínimo por token.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2. Origem da aprovação (texto: x-forwarded-for pode vir vazio ou múltiplo)
-- ---------------------------------------------------------------------------

alter table public.aprovacoes
  add column if not exists autor_ip text,
  add column if not exists autor_user_agent text;

-- ---------------------------------------------------------------------------
-- 3a. Token de aprovação novo revoga os anteriores não usados da mesma etapa
-- ---------------------------------------------------------------------------

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
    and etapa = p_etapa::aprovacao_priv.etapa_token
    and usado_em is null
    and expira_em > now();

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
-- 1 + 2. Registro da aprovação com e-mail obrigatório e origem
-- ---------------------------------------------------------------------------

-- A versão de 5 argumentos sai de cena para não criar ambiguidade de overload
-- (as novas colunas entram como parâmetros com default).
drop function if exists public.registrar_aprovacao(text, text, text, text, text);

create or replace function public.registrar_aprovacao(
  p_token text, p_decisao text, p_autor_nome text,
  p_autor_email text default null, p_observacao text default null,
  p_autor_ip text default null, p_autor_user_agent text default null
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
  v_solicitacao date;
begin
  if p_autor_nome is null or btrim(p_autor_nome) = '' then
    raise exception 'Informe o nome de quem está aprovando.';
  end if;
  if p_autor_email is null or btrim(p_autor_email) = '' then
    raise exception 'Informe o e-mail de quem está aprovando.';
  end if;
  if position('@' in btrim(p_autor_email)) = 0 then
    raise exception 'E-mail inválido.';
  end if;
  if p_decisao not in ('aprovada', 'aprovada_com_ressalvas', 'recusada') then
    raise exception 'Decisão inválida.';
  end if;
  v_decisao_id := public.id_decisao(p_decisao);

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.entrega_id, t.etapa::text
    into v_token_id, v_entrega_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash and t.expira_em > now() and t.usado_em is null
  for update of t;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select e.titulo, f.codigo, e.data_solicitacao_id
    into v_titulo, v_fase_atual, v_solicitacao
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  where e.id = v_entrega_id;

  if v_etapa = 'planejamento' then
    v_fase_nova := case when p_decisao = 'recusada' then 'ajuste_solicitado' else 'em_producao' end;
    update public.entregas
    set fase_id = public.id_fase(v_fase_nova),
        aprovacao_planejamento_id = v_decisao_id
    where id = v_entrega_id;
  else
    v_fase_nova := case when p_decisao = 'recusada' then 'ajuste_solicitado' else 'aprovada' end;
    update public.entregas
    set fase_id = public.id_fase(v_fase_nova),
        aprovacao_entrega_id = v_decisao_id
    where id = v_entrega_id;
  end if;

  insert into public.aprovacoes
    (entrega_id, etapa_id, decisao_id, autor_nome, autor_email, autor_ip,
     autor_user_agent, observacao, origem_id, data_solicitacao, data_decisao,
     dias_ate_decisao)
  values (
    v_entrega_id, public.id_etapa(v_etapa), v_decisao_id,
    btrim(p_autor_nome), btrim(p_autor_email), nullif(btrim(p_autor_ip), ''),
    nullif(btrim(p_autor_user_agent), ''), p_observacao,
    public.id_origem('app'), v_solicitacao, now(),
    case when v_solicitacao is null then null else now()::date - v_solicitacao end
  );

  insert into public.eventos_entrega
    (entrega_id, tipo_evento, campo, valor_antigo, valor_novo,
     fase_origem_id, fase_destino_id, autor, origem_id)
  values (
    v_entrega_id, 'fase', 'fase', v_fase_atual, v_fase_nova,
    public.id_fase(v_fase_atual), public.id_fase(v_fase_nova),
    'Cliente via link: ' || btrim(p_autor_nome), public.id_origem('app')
  );

  update aprovacao_priv.aprovacao_tokens set usado_em = now() where id = v_token_id;

  return jsonb_build_object(
    'entrega_id', v_entrega_id, 'titulo', v_titulo, 'etapa', v_etapa,
    'decisao', p_decisao, 'fase', v_fase_nova, 'fase_anterior', v_fase_atual
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3b. Link do portal novo revoga os anteriores ainda válidos do mesmo cliente
-- ---------------------------------------------------------------------------

create or replace function public.criar_acesso_cliente(
  p_cliente_id bigint, p_validade_dias integer default 90
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare v_token text;
begin
  if p_validade_dias not between 1 and 365 then
    raise exception 'Validade deve ser entre 1 e 365 dias.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  -- Um link novo substitui o anterior: quem tem o link velho perde o acesso.
  update aprovacao_priv.cliente_acessos
  set expira_em = now()
  where cliente_id = p_cliente_id
    and expira_em > now();

  v_token := gen_random_uuid()::text;
  insert into aprovacao_priv.cliente_acessos (token_hash, cliente_id, expira_em)
  values (
    encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
    p_cliente_id,
    now() + make_interval(days => p_validade_dias)
  );
  return v_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4a. Portal do cliente passa a listar as aprovações pendentes
-- ---------------------------------------------------------------------------

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

  -- Só entra o que está de fato na vez do cliente: a fase diz que o time
  -- terminou a etapa e aguarda a decisão.
  select coalesce(jsonb_agg(to_jsonb(p) order by p.data_prevista nulls last, p.entrega_id), '[]')
  into v_pendencias
  from (
    select e.id as entrega_id, e.titulo, 'planejamento'::text as etapa, e.data_prevista
    from public.entregas_detalhadas e
    where e.cliente_id = v_cliente_id
      and e.fase = 'aguardando_cliente'
      and e.aprovacao_planejamento = 'pendente'
    union all
    select e.id as entrega_id, e.titulo, 'entrega'::text as etapa, e.data_prevista
    from public.entregas_detalhadas e
    where e.cliente_id = v_cliente_id
      and e.fase = 'aguardando_aprovacao_entrega'
      and e.aprovacao_entrega = 'pendente'
  ) p;

  return jsonb_build_object(
    'cliente', v_cliente,
    'entregas', v_entregas,
    'pendencias_aprovacao', v_pendencias
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4b. O portal abre o link de aprovação sem depender do time
--
-- O token do portal prova que quem pede é o cliente daquela entrega. A função
-- só emite token quando a entrega está realmente na fase que aguarda aquela
-- etapa — não dá para adiantar uma aprovação.
-- ---------------------------------------------------------------------------

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

  select exists(
    select 1
    from public.entregas e
    join public.fases f on f.id = e.fase_id
    join public.decisoes_aprovacao ap on ap.id = e.aprovacao_planejamento_id
    join public.decisoes_aprovacao ae on ae.id = e.aprovacao_entrega_id
    where e.id = p_entrega_id
      and e.cliente_id = v_cliente_id
      and (
        (p_etapa = 'planejamento' and ap.codigo = 'pendente' and f.codigo = 'aguardando_cliente')
        or
        (p_etapa = 'entrega' and ae.codigo = 'pendente' and f.codigo = 'aguardando_aprovacao_entrega')
      )
  ) into v_pode;

  if not v_pode then
    raise exception 'Esta entrega não está aguardando essa aprovação.';
  end if;

  return public.criar_token_aprovacao(p_entrega_id, p_etapa, p_validade_horas);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trava de execução: só a rota de servidor (service_role).
-- ---------------------------------------------------------------------------

revoke all on function public.criar_token_aprovacao(bigint, text, integer) from public, anon, authenticated;
revoke all on function public.registrar_aprovacao(text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.criar_acesso_cliente(bigint, integer) from public, anon, authenticated;
revoke all on function public.dados_cliente_por_token(text) from public, anon, authenticated;
revoke all on function public.criar_token_aprovacao_portal(text, bigint, text, integer) from public, anon, authenticated;

grant execute on function public.criar_token_aprovacao(bigint, text, integer) to service_role;
grant execute on function public.registrar_aprovacao(text, text, text, text, text, text, text) to service_role;
grant execute on function public.criar_acesso_cliente(bigint, integer) to service_role;
grant execute on function public.dados_cliente_por_token(text) to service_role;
grant execute on function public.criar_token_aprovacao_portal(text, bigint, text, integer) to service_role;
