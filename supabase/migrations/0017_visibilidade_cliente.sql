-- ============================================================================
-- PlanHub — Migration 17: visibilidade do cliente (portal + aprovação rica)
--
-- C — Portal do cliente: um link read-only por cliente (token de longa duração)
--     com todas as entregas daquele cliente. Sem login.
-- A — Página de aprovação: passa a devolver também a linha do tempo da entrega,
--     as aprovações registradas e outras pendências do mesmo cliente.
--
-- Segurança (mesma porta das aprovações):
--   - Token nunca em claro: só sha256(token).
--   - Funções SECURITY DEFINER, EXECUTE revogado de PUBLIC/anon/authenticated e
--     concedido apenas ao service_role (quem chama é a rota de servidor).
--   - O portal filtra por cliente_id do token: nunca expõe outro cliente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- C — Acessos de cliente (read-only)
-- ---------------------------------------------------------------------------

create table if not exists aprovacao_priv.cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  cliente_id bigint not null references public.clientes (id) on delete cascade,
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_cliente_acesso_cliente
  on aprovacao_priv.cliente_acessos (cliente_id);

alter table aprovacao_priv.cliente_acessos enable row level security;
revoke all on aprovacao_priv.cliente_acessos from anon;

-- Geração do link de acompanhamento (app, lado servidor).
create or replace function public.criar_acesso_cliente(
  p_cliente_id bigint, p_validade_dias integer default 90
)
returns text
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $fn$
declare
  v_token text;
begin
  if p_validade_dias not between 1 and 365 then
    raise exception 'Validade deve ser entre 1 e 365 dias.';
  end if;
  if not exists (select 1 from public.clientes where id = p_cliente_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  v_token := gen_random_uuid()::text;
  insert into aprovacao_priv.cliente_acessos (token_hash, cliente_id, expira_em)
  values (
    encode(sha256(convert_to(v_token, 'utf8')), 'hex'),
    p_cliente_id,
    now() + make_interval(days => p_validade_dias)
  );
  return v_token;
end;
$fn$;

-- Dados do cliente resolvidos pelo token (read-only).
create or replace function public.dados_cliente_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $fn$
declare
  v_hash text;
  v_cliente_id bigint;
  v_cliente text;
  v_entregas jsonb;
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

  return jsonb_build_object(
    'cliente', v_cliente,
    'entregas', v_entregas
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- A — Dados públicos da entrega para a página de aprovação (com timeline)
-- ---------------------------------------------------------------------------

create or replace function public.dados_entrega_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $fn$
declare
  v_hash text;
  v_token_id uuid;
  v_etapa text;
  v_entrega public.entregas_detalhadas;
  v_historico jsonb;
  v_aprovacoes jsonb;
  v_pendencias jsonb;
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

  -- Linha do tempo da entrega (máx. 20 eventos mais recentes).
  select coalesce(jsonb_agg(to_jsonb(h) order by h.criado_em desc), '[]')
  into v_historico
  from (
    select tipo_evento, campo, valor_antigo, valor_novo, autor, criado_em,
           fase_origem, fase_destino
    from public.eventos_detalhados
    where entrega_id = v_entrega.id
  ) h;

  -- Aprovações registradas (por etapa).
  select coalesce(jsonb_agg(to_jsonb(a) order by a.criado_em desc), '[]')
  into v_aprovacoes
  from (
    select et.codigo as etapa, da.codigo as decisao, ap.autor_nome, ap.autor_email,
           ap.observacao, ap.criado_em
    from public.aprovacoes ap
    join public.etapas_aprovacao et on et.id = ap.etapa_id
    join public.decisoes_aprovacao da on da.id = ap.decisao_id
    where ap.entrega_id = v_entrega.id
  ) a;

  -- Outras entregas do mesmo cliente aguardando o cliente (não a atual).
  select coalesce(jsonb_agg(to_jsonb(o) order by o.data_prevista nulls last), '[]')
  into v_pendencias
  from (
    select id, titulo, fase, fase_rotulo, data_prevista
    from public.entregas_detalhadas
    where cliente_id = v_entrega.cliente_id
      and id <> v_entrega.id
      and fase in ('aguardando_cliente', 'aguardando_aprovacao_entrega')
  ) o;

  return jsonb_build_object(
    'entrega_id', v_entrega.id, 'titulo', v_entrega.titulo, 'tipo', v_entrega.tipo,
    'cliente', v_entrega.cliente, 'etapa', v_etapa, 'data_prevista', v_entrega.data_prevista,
    'num_revisoes', v_entrega.num_revisoes, 'link', v_entrega.link,
    'aprovacao_planejamento', v_entrega.aprovacao_planejamento,
    'aprovacao_entrega', v_entrega.aprovacao_entrega,
    'historico', v_historico,
    'aprovacoes', v_aprovacoes,
    'outras_pendencias', v_pendencias
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Permissões: só a rota de servidor (service_role).
-- ---------------------------------------------------------------------------

revoke all on function public.criar_acesso_cliente(bigint, integer) from public, anon, authenticated;
revoke all on function public.dados_cliente_por_token(text) from public, anon, authenticated;
revoke all on function public.dados_entrega_por_token(text) from public, anon, authenticated;

grant execute on function public.criar_acesso_cliente(bigint, integer) to service_role;
grant execute on function public.dados_cliente_por_token(text) to service_role;
grant execute on function public.dados_entrega_por_token(text) to service_role;