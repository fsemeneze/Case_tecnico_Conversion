-- ============================================================================
-- Fase 2 — Migration 4: aprovação do cliente por link com token (D3)
--
-- Fluxo: o app cria um token (etapa planejamento ou entrega, com validade) e
-- manda o link ao cliente. O cliente NÃO tem login: a página de aprovação
-- chama `aprovacao_priv.registrar_aprovacao(token, decisao, nome, email)`,
-- que expõe exatamente a entrega do token e devolve o resumo da confirmação.
--
-- Cuidados do checklist de segurança (skill supabase):
--   - Token nunca armazenado em claro: só sha256(token).
--   - Uso único por etapa (`usado_em`) e expiração.
--   - Funções SECURITY DEFINER dentro de schema NÃO exposto pela Data API,
--     com EXECUTE revogado de PUBLIC e concedido apenas ao service_role
--     (quem chama é a rota de servidor do app, nunca o browser).
--   - `registrar_aprovacao` é a única porta de entrada do cliente: valida
--     token, aplica a transição de fase e registra autor + decisão.
-- ============================================================================

create table aprovacao_priv.aprovacao_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  entrega_id bigint not null references public.entregas (id) on delete cascade,
  etapa etapa_aprovacao not null,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_tokens_entrega on aprovacao_priv.aprovacao_tokens (entrega_id);

-- RLS em tudo, inclusive no schema privado (defense in depth, skill supabase).
-- Nenhuma política: ninguém lê tokens direto — só as funções SECURITY DEFINER.
alter table aprovacao_priv.aprovacao_tokens enable row level security;
revoke all on aprovacao_priv.aprovacao_tokens from anon;

-- ---------------------------------------------------------------------------
-- Criação de token (chamada pelo app, lado servidor)
-- ---------------------------------------------------------------------------

create or replace function aprovacao_priv.criar_token_aprovacao(
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

-- ---------------------------------------------------------------------------
-- Registro da aprovação (chamada pela página pública do link)
-- ---------------------------------------------------------------------------

create or replace function aprovacao_priv.registrar_aprovacao(
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

  -- Lock na linha do token: uso único mesmo em chamadas concorrentes.
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

  select * into v_entrega from public.entregas where id = v_entrega_id;
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

-- ---------------------------------------------------------------------------
-- Permissões: EXECUTE apenas para o service_role (rota de servidor).
-- PUBLIC vem concedido por padrão — precisa ser revogado.
-- ---------------------------------------------------------------------------

revoke all on function aprovacao_priv.criar_token_aprovacao(bigint, etapa_aprovacao, integer)
  from public;
revoke all on function aprovacao_priv.registrar_aprovacao(text, text, text, text, text)
  from public;

grant execute on function aprovacao_priv.criar_token_aprovacao(bigint, etapa_aprovacao, integer)
  to service_role;
grant execute on function aprovacao_priv.registrar_aprovacao(text, text, text, text, text)
  to service_role;
