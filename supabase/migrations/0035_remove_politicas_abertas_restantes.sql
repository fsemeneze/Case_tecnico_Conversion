-- ============================================================================
-- PlanHub — Migration 35: remove as políticas abertas restantes
--
-- Mesmo problema da 34, em outras tabelas: as políticas antigas (singular)
-- eram permissivas e se combinavam com OR, anulando a regra por squad.
--   - erro_select / erro_update (erros_importacao)
--   - encerramentos_select (qualquer ativo)
--   - notificacoes_select (qualquer ativo)
-- ============================================================================

drop policy if exists "erro_select" on public.erros_importacao;
drop policy if exists "erro_update" on public.erros_importacao;

create policy "erros_update" on public.erros_importacao
  for update to authenticated
  using (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or (
        erros_importacao.entrega_id is not null
        and public.pode_ver_entrega(erros_importacao.entrega_id)
      )
    )
  )
  with check (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or (
        erros_importacao.entrega_id is not null
        and public.pode_ver_entrega(erros_importacao.entrega_id)
      )
    )
  );

drop policy if exists "encerramentos_select" on public.encerramentos;
create policy "encerramentos_select" on public.encerramentos
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or (
        encerramentos.entrega_id is not null
        and public.pode_ver_entrega(encerramentos.entrega_id)
      )
    )
  );

drop policy if exists "notificacoes_select" on public.notificacoes;
create policy "notificacoes_select" on public.notificacoes
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or (
        notificacoes.entidade_id is not null
        and public.pode_ver_entrega(notificacoes.entidade_id)
      )
    )
  );