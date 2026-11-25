-- ============================================================================
-- P0 — Migration 8: usuários e papéis (acesso real)
--
-- Papéis: admin (gerencia tudo), gestor (entregas + aprovação interna),
-- operador (cria e edita entregas), leitor (só consulta).
-- Cadastro de conta é por convite (convite admin). Sign-up público desligado
-- no painel do Supabase — confirmar em Authentication → Providers.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Papéis
-- ---------------------------------------------------------------------------

create type papel_usuario as enum ('admin', 'gestor', 'operador', 'leitor');

create table public.usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null,
  papel papel_usuario not null default 'leitor',
  ativo boolean not null default true,
  criado_por uuid references auth.users (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.convite (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  papel papel_usuario not null default 'operador',
  convocado_por uuid not null references auth.users (id),
  valido_ate timestamptz not null default now() + interval '7 days',
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_usuario_papel on usuario (papel);
create index idx_convite_pendentes on convite (usado_em, valido_ate);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (SECURITY INVOKER, search_path fixado)
-- ---------------------------------------------------------------------------

create or replace function public.papel_atual()
returns papel_usuario
language sql
stable
security invoker
set search_path = public
as $$
  select papel from public.usuario
  where id = (select auth.uid()) and ativo;
$$;

create or replace function public.usuario_esta_ativo()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.usuario
    where id = (select auth.uid()) and ativo
  );
$$;

-- Alias curto para as políticas: o usuário autenticado (ou null).
create or replace function public.usuario_atual()
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select id from public.usuario
  where id = (select auth.uid()) and ativo;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.usuario enable row level security;
alter table public.convite enable row level security;

-- O próprio usuário lê seu perfil.
create policy "usuario_select_proprio" on usuario
  for select to authenticated
  using (id = (select auth.uid()));

-- Admin lê e gerencia todos os usuários.
create policy "usuario_admin_tudo" on usuario
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

-- Convite: só admin lê e cria.
create policy "convite_admin_tudo" on convite
  for all to authenticated
  using (public.papel_atual() = 'admin')
  with check (public.papel_atual() = 'admin');

-- ---------------------------------------------------------------------------
-- Acesso às entregas por papel
--
-- A substituição das políticas antigas (`using (true)`) e a troca do
-- `usuario` por `auth.users` nasPolicies ocorre na migration 0009, após a
-- migração dos dados e a validação por contagem.
-- ---------------------------------------------------------------------------

revoke all on usuario, convite from anon;