-- ============================================================================
-- Fase 2 — Migration 2: RLS
--
-- Modelo de acesso:
--   - Time interno (Conversion): login por Supabase Auth → role
--     `authenticated` → acesso completo a entregas, clientes e histórico.
--     É um workspace único da equipe: quem está autenticado vê tudo.
--   - Cliente: sem login. Só interage pela função registrar_aprovacao
--     (migration 4), que expõe exatamente uma entrega.
--   - `anon`: sem acesso a nenhuma tabela — revogado mesmo que a Data API
--     exponha os schemas (defense in depth).
-- ============================================================================

alter table clientes enable row level security;
alter table entregas enable row level security;
alter table aprovacoes enable row level security;
alter table entrega_historico enable row level security;
alter table erros_importacao enable row level security;
alter table aprovacao_priv.aprovacao_tokens enable row level security;

-- ---------------------------------------------------------------------------
-- Políticas — time interno
-- ---------------------------------------------------------------------------

create policy "clientes_select_time" on clientes
  for select to authenticated using (true);

create policy "clientes_insert_time" on clientes
  for insert to authenticated with check (true);

create policy "clientes_update_time" on clientes
  for update to authenticated using (true) with check (true);

create policy "clientes_delete_time" on clientes
  for delete to authenticated using (true);

create policy "entregas_select_time" on entregas
  for select to authenticated using (true);

create policy "entregas_insert_time" on entregas
  for insert to authenticated with check (true);

create policy "entregas_update_time" on entregas
  for update to authenticated using (true) with check (true);

create policy "entregas_delete_time" on entregas
  for delete to authenticated using (true);

-- Histórico de aprovações é imutável para o app: selecionar e inserir.
create policy "aprovacoes_select_time" on aprovacoes
  for select to authenticated using (true);

create policy "aprovacoes_insert_time" on aprovacoes
  for insert to authenticated with check (true);

create policy "historico_select_time" on entrega_historico
  for select to authenticated using (true);

create policy "erros_select_time" on erros_importacao
  for select to authenticated using (true);

-- A única escrita na fila de revisão é marcar/desmarcar revisão feita.
create policy "erros_update_time" on erros_importacao
  for update to authenticated using (true) with check (true);

-- aprovacao_priv.aprovacao_tokens: RLS habilitado e NENHUMA política.
-- Nem o time acessa tokens direto — só as funções SECURITY DEFINER.
-- (Se alguém expor o schema por engano, zero linhas vazam.)

-- ---------------------------------------------------------------------------
-- anon não vê nada
-- ---------------------------------------------------------------------------

revoke all on clientes from anon;
revoke all on entregas from anon;
revoke all on aprovacoes from anon;
revoke all on entrega_historico from anon;
revoke all on erros_importacao from anon;
revoke all on aprovacao_priv.aprovacao_tokens from anon;
