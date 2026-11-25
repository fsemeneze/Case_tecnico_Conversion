-- ============================================================================
-- PlanOps — Migration 14: funções e RLS
--
-- Funções de aprovação (SECURITY DEFINER, EXECUTE só do service_role) e
-- RLS por papel sobre o modelo estrela.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Resolução de dimensão
-- ---------------------------------------------------------------------------

create or replace function public.id_fase(p_codigo text)
returns bigint language sql stable security invoker set search_path = public
as $$ select id from public.fases where codigo = p_codigo; $$;

create or replace function public.id_decisao(p_codigo text)
returns bigint language sql stable security invoker set search_path = public
as $$ select id from public.decisoes_aprovacao where codigo = p_codigo; $$;

create or replace function public.id_etapa(p_codigo text)
returns bigint language sql stable security invoker set search_path = public
as $$ select id from public.etapas_aprovacao where codigo = p_codigo; $$;

create or replace function public.id_origem(p_codigo text)
returns bigint language sql stable security invoker set search_path = public
as $$ select id from public.origens where codigo = p_codigo; $$;

-- ---------------------------------------------------------------------------
-- Token de aprovação
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
  p_token text, p_decisao text, p_autor_nome text,
  p_autor_email text default null, p_observacao text default null
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
    (entrega_id, etapa_id, decisao_id, autor_nome, autor_email, observacao,
     origem_id, data_solicitacao, data_decisao, dias_ate_decisao)
  values (
    v_entrega_id, public.id_etapa(v_etapa), v_decisao_id,
    btrim(p_autor_nome), p_autor_email, p_observacao,
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
declare v_ativos integer; v_ultimo timestamptz;
begin
  select count(*), max(expira_em) into v_ativos, v_ultimo
  from aprovacao_priv.aprovacao_tokens
  where entrega_id = p_entrega_id and usado_em is null and expira_em > now();
  return jsonb_build_object('ativos', v_ativos, 'ultimo_expira_em', v_ultimo);
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
revoke all on function public.id_fase(text) from public, anon;
revoke all on function public.id_decisao(text) from public, anon;
revoke all on function public.id_etapa(text) from public, anon;
revoke all on function public.id_origem(text) from public, anon;

grant execute on function public.criar_token_aprovacao(bigint, text, integer) to service_role;
grant execute on function public.registrar_aprovacao(text, text, text, text, text) to service_role;
grant execute on function public.dados_entrega_por_token(text) to service_role;
grant execute on function public.links_aprovacao_ativos(bigint) to service_role;

-- ---------------------------------------------------------------------------
-- RLS por papel
--   leitura: qualquer usuário ativo
--   escrita: admin, gestor e operador (exclusão só admin)
-- ---------------------------------------------------------------------------

alter table public.clientes enable row level security;
alter table public.aliases_cliente enable row level security;
alter table public.pessoas enable row level security;
alter table public.squads enable row level security;
alter table public.tipos_entrega enable row level security;
alter table public.fases enable row level security;
alter table public.decisoes_aprovacao enable row level security;
alter table public.etapas_aprovacao enable row level security;
alter table public.origens enable row level security;
alter table public.calendario enable row level security;
alter table public.entregas enable row level security;
alter table public.eventos_entrega enable row level security;
alter table public.aprovacoes enable row level security;
alter table public.erros_importacao enable row level security;

create policy "clientes_select" on clientes
  for select to authenticated using (public.usuario_esta_ativo());
create policy "clientes_write" on clientes
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "aliases_select" on aliases_cliente
  for select to authenticated using (public.usuario_esta_ativo());
create policy "aliases_write" on aliases_cliente
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "pessoas_select" on pessoas
  for select to authenticated using (public.usuario_esta_ativo());
create policy "pessoas_write" on pessoas
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "squads_select" on squads
  for select to authenticated using (public.usuario_esta_ativo());
create policy "squads_write" on squads
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "tipos_select" on tipos_entrega
  for select to authenticated using (public.usuario_esta_ativo());
create policy "fases_select" on fases
  for select to authenticated using (public.usuario_esta_ativo());
create policy "decisoes_select" on decisoes_aprovacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "etapas_select" on etapas_aprovacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "origens_select" on origens
  for select to authenticated using (public.usuario_esta_ativo());
create policy "calendario_select" on calendario
  for select to authenticated using (public.usuario_esta_ativo());

create policy "entregas_select" on entregas
  for select to authenticated using (public.usuario_esta_ativo());
create policy "entregas_insert" on entregas
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));
create policy "entregas_update" on entregas
  for update to authenticated
  using (public.papel_atual() in ('admin', 'gestor', 'operador'))
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));
create policy "entregas_delete" on entregas
  for delete to authenticated using (public.papel_atual() = 'admin');

create policy "eventos_select" on eventos_entrega
  for select to authenticated using (public.usuario_esta_ativo());
create policy "eventos_insert" on eventos_entrega
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

create policy "aprovacoes_select" on aprovacoes
  for select to authenticated using (public.usuario_esta_ativo());
create policy "aprovacoes_insert" on aprovacoes
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor'));

create policy "erros_select" on erros_importacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "erros_update" on erros_importacao
  for update to authenticated
  using (public.papel_atual() in ('admin', 'gestor', 'operador'))
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

-- anon não vê nada (defense in depth)
revoke all on clientes, aliases_cliente, pessoas, squads, tipos_entrega,
  fases, decisoes_aprovacao, etapas_aprovacao, origens, calendario,
  entregas, eventos_entrega, aprovacoes, erros_importacao from anon;
revoke all on entregas_detalhadas, indicadores_mensais, eventos_detalhados from anon;