-- ============================================================================
-- PlanOps — Migration 13: RLS por papel no modelo estrela
--
-- Papéis: admin (tudo), gestor (entregas + aprovação interna),
-- operador (cria e edita entregas), leitor (só consulta).
--
-- Princípios (skill supabase):
--   - `TO authenticated` + predicado de papel, nunca só a role.
--   - UPDATE exige USING e WITH CHECK.
--   - Views com security_invoker = true: o RLS da tabela base vale.
--   - Nenhuma política para anon.
-- ============================================================================

alter table public.dim_cliente enable row level security;
alter table public.dim_pessoa enable row level security;
alter table public.dim_squad enable row level security;
alter table public.dim_tipo_entrega enable row level security;
alter table public.dim_fase enable row level security;
alter table public.dim_status_aprovacao enable row level security;
alter table public.dim_etapa_aprovacao enable row level security;
alter table public.dim_origem enable row level security;
alter table public.dim_data enable row level security;
alter table public.ponte_cliente_alias enable row level security;

alter table public.fato_entrega enable row level security;
alter table public.fato_evento_entrega enable row level security;
alter table public.fato_aprovacao enable row level security;

-- ---------------------------------------------------------------------------
-- Dimensões: leitura para todo usuário ativo; escrita só admin.
-- ---------------------------------------------------------------------------

create policy "dim_cliente_select" on dim_cliente
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_cliente_write" on dim_cliente
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "dim_pessoa_select" on dim_pessoa
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_pessoa_write" on dim_pessoa
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "dim_squad_select" on dim_squad
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_squad_write" on dim_squad
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

create policy "dim_tipo_select" on dim_tipo_entrega
  for select to authenticated using (public.usuario_esta_ativo());

create policy "dim_fase_select" on dim_fase
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_status_select" on dim_status_aprovacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_etapa_select" on dim_etapa_aprovacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_origem_select" on dim_origem
  for select to authenticated using (public.usuario_esta_ativo());
create policy "dim_data_select" on dim_data
  for select to authenticated using (public.usuario_esta_ativo());

create policy "alias_select" on ponte_cliente_alias
  for select to authenticated using (public.usuario_esta_ativo());
create policy "alias_write" on ponte_cliente_alias
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

-- ---------------------------------------------------------------------------
-- fato_entrega
--   leitura: qualquer usuário ativo
--   escrita: admin, gestor e operador (criar/editar)
--   exclusão: só admin
-- ---------------------------------------------------------------------------

create policy "entrega_select" on fato_entrega
  for select to authenticated using (public.usuario_esta_ativo());

create policy "entrega_insert" on fato_entrega
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

create policy "entrega_update" on fato_entrega
  for update to authenticated
  using (public.papel_atual() in ('admin', 'gestor', 'operador'))
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

create policy "entrega_delete" on fato_entrega
  for delete to authenticated
  using (public.papel_atual() = 'admin');

-- ---------------------------------------------------------------------------
-- Histórico e aprovações: leitura para todos; inserção por admin/gestor
-- (o cliente entra pela função SECURITY DEFINER, que ignora RLS).
-- ---------------------------------------------------------------------------

create policy "evento_select" on fato_evento_entrega
  for select to authenticated using (public.usuario_esta_ativo());

create policy "evento_insert" on fato_evento_entrega
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

create policy "aprovacao_select" on fato_aprovacao
  for select to authenticated using (public.usuario_esta_ativo());

create policy "aprovacao_insert" on fato_aprovacao
  for insert to authenticated
  with check (public.papel_atual() in ('admin', 'gestor'));

-- ---------------------------------------------------------------------------
-- anon não vê nada (defense in depth)
-- ---------------------------------------------------------------------------

revoke all on dim_cliente, dim_pessoa, dim_squad, dim_tipo_entrega,
  dim_fase, dim_status_aprovacao, dim_etapa_aprovacao, dim_origem,
  dim_data, ponte_cliente_alias from anon;
revoke all on fato_entrega, fato_evento_entrega, fato_aprovacao from anon;
revoke all on vw_entregas, vw_indicadores_mensais, vw_eventos_entrega from anon;