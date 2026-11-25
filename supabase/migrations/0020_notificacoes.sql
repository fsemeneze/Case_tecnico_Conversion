-- ============================================================================
-- PlanOps — Migration 20: notificações por e-mail (D)
--
-- Registro de auditoria dos e-mails enviados (link de aprovação, decisão do
-- cliente, aviso de prazo). O envio é feito pela rota de servidor (service_role);
-- a tabela guarda status e erro para conferência.
-- ============================================================================

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  destino text not null,
  assunto text,
  status text not null check (status in ('enviado', 'erro')),
  erro text,
  entidade_id bigint,
  criado_em timestamptz not null default now()
);

create index if not exists idx_notificacoes_tipo on public.notificacoes (tipo, criado_em desc);

alter table public.notificacoes enable row level security;

create policy "notificacoes_select" on public.notificacoes
  for select to authenticated using (public.usuario_esta_ativo());

revoke all on public.notificacoes from anon;