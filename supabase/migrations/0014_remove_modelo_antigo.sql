-- ============================================================================
-- PlanOps — Migration 14: remove o modelo antigo
--
-- Só roda depois da migration 11 validar as contagens. O modelo estrela
-- (fato_* + dim_* + vw_*) é a única fonte de dados.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Fila de revisão: fato_erro_importacao (grão: problema encontrado)
-- ---------------------------------------------------------------------------

create table public.fato_erro_importacao (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint references public.fato_entrega (id) on delete set null,
  legacy_id integer,
  codigo text not null,
  severidade text not null check (severidade in ('aviso', 'critico')),
  detalhe text,
  origem_linha jsonb,
  resolvido boolean not null default false,
  resolvido_por uuid references auth.users (id),
  resolvido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index idx_erro_entrega on fato_erro_importacao (entrega_id);
create index idx_erro_pendentes on fato_erro_importacao (resolvido) where not resolvido;
create index idx_erro_codigo on fato_erro_importacao (codigo);

alter table public.fato_erro_importacao enable row level security;

create policy "erro_select" on fato_erro_importacao
  for select to authenticated using (public.usuario_esta_ativo());
create policy "erro_update" on fato_erro_importacao
  for update to authenticated
  using (public.papel_atual() in ('admin', 'gestor', 'operador'))
  with check (public.papel_atual() in ('admin', 'gestor', 'operador'));

revoke all on fato_erro_importacao from anon;

-- Migra a fila existente, vinculando pelo legacy_id único.
insert into public.fato_erro_importacao
  (entrega_id, legacy_id, codigo, severidade, detalhe, origem_linha, resolvido, criado_em)
select
  f.id, e.legacy_id, e.codigo, e.severidade::text, e.detalhe, e.origem_linha,
  e.resolvido, e.criado_em
from public.erros_importacao e
left join public.fato_entrega f on f.legacy_id = e.legacy_id;

-- Funções antigas (migration 4/7) não são mais usadas.
drop function if exists public.criar_token_aprovacao(bigint, etapa_aprovacao, integer);
drop function if exists public.registrar_aprovacao(text, text, text, text, text);
drop function if exists public.dados_entrega_por_token(text);
drop function if exists public.links_aprovacao_ativos(bigint);

-- Tabelas antigas. A ordem respeita as FKs.
drop table if exists public.entrega_historico cascade;
drop table if exists public.aprovacoes cascade;
drop table if exists public.erros_importacao cascade;
drop table if exists public.entregas cascade;
drop table if exists public.clientes cascade;

-- Trigger e função de updated_at do modelo antigo.
drop function if exists public.entrega_historico_fn();
drop function if exists public.set_updated_at();