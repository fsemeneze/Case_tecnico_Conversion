-- ============================================================================
-- PlanHub — Migration 33: operador por squad + edição de entrega
--
-- Cada usuário passa a ter um squad (usuario.squad_id). O papel operador só
-- vê e edita as entregas do próprio squad; admin e gestor veem tudo.
-- A regra vive no banco (RLS), o app só apresenta.
-- ============================================================================

alter table public.usuario
  add column if not exists squad_id bigint references public.squads (id);

create index if not exists idx_usuario_squad on public.usuario (squad_id);

-- Squad do usuário atual (null para admin/gestor sem squad definido).
create or replace function public.squad_atual()
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select squad_id from public.usuario
  where id = (select auth.uid()) and ativo
$$;

-- A entrega está visível para o usuário atual?
create or replace function public.pode_ver_entrega(p_entrega_id bigint)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.entregas e
    where e.id = p_entrega_id
      and (
        public.papel_atual() in ('admin', 'gestor')
        or public.squad_atual() is null
        or e.squad_id = public.squad_atual()
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Políticas: leitura por squad, escrita por squad (operador).
-- ---------------------------------------------------------------------------

drop policy if exists "entregas_select" on public.entregas;
create policy "entregas_select" on public.entregas
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or public.squad_atual() is null
      or entregas.squad_id = public.squad_atual()
    )
  );

drop policy if exists "entregas_update" on public.entregas;
create policy "entregas_update" on public.entregas
  for update to authenticated
  using (
    public.papel_atual() in ('admin', 'gestor')
    or (
      public.papel_atual() = 'operador'
      and (public.squad_atual() is null or entregas.squad_id = public.squad_atual())
    )
  )
  with check (
    public.papel_atual() in ('admin', 'gestor')
    or (
      public.papel_atual() = 'operador'
      and (public.squad_atual() is null or entregas.squad_id = public.squad_atual())
    )
  );

drop policy if exists "eventos_select" on public.eventos_entrega;
create policy "eventos_select" on public.eventos_entrega
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and public.pode_ver_entrega(eventos_entrega.entrega_id)
  );

drop policy if exists "aprovacoes_select" on public.aprovacoes;
create policy "aprovacoes_select" on public.aprovacoes
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and public.pode_ver_entrega(aprovacoes.entrega_id)
  );

drop policy if exists "erros_select" on public.erros_importacao;
create policy "erros_select" on public.erros_importacao
  for select to authenticated
  using (
    public.usuario_esta_ativo()
    and (
      public.papel_atual() in ('admin', 'gestor')
      or (
        erros_importacao.entrega_id is not null
        and public.pode_ver_entrega(erros_importacao.entrega_id)
      )
    )
  );