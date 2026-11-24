-- ============================================================================
-- Fase 2 — Migration 5: endurecimento após advisors
--
-- Corrige os avisos do linter de segurança (após aplicar 0001 a 0004):
--   1. pg_trgm no schema `extensions` (padrão Supabase), e não em `public`.
--   2. search_path fixado nas funções de trigger de `public` (evita
--      sequestro de search_path por outro role).
--   3. Índice no FK de erros_importacao (performance).
--   4. rls_auto_enable(): função de event trigger da plataforma — o gatilho
--      dispara com privilégios do dono independente de EXECUTE; revogar
--      EXECUTE de anon/authenticated impede chamada direta via RPC.
-- ============================================================================

-- 1. pg_trgm no schema de extensões ------------------------------------------------

drop index if exists idx_entregas_titulo_trgm;

alter extension pg_trgm set schema extensions;

create index idx_entregas_titulo_trgm on entregas
  using gin (titulo extensions.gin_trgm_ops);

-- 2. search_path fixado -----------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function entrega_historico_fn()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_antigo jsonb;
  v_novo jsonb;
  v_campo text;
  v_autor text;
begin
  v_autor := nullif(current_setting('app.autor', true), '');
  v_antigo := to_jsonb(old) - 'updated_at';
  v_novo := to_jsonb(new) - 'updated_at';

  for v_campo in select jsonb_object_keys(v_novo)
  loop
    -- Campos técnicos ficam fora do histórico.
    if v_campo in ('id', 'legacy_id', 'criado_em', 'origem_linha') then
      continue;
    end if;

    if v_antigo -> v_campo is distinct from v_novo -> v_campo then
      insert into entrega_historico (entrega_id, campo, valor_antigo, valor_novo, autor)
      values (
        new.id,
        v_campo,
        case v_antigo -> v_campo
          when 'null' then null
          else v_antigo ->> v_campo
        end,
        case v_novo -> v_campo
          when 'null' then null
          else v_novo ->> v_campo
        end,
        v_autor
      );
    end if;
  end loop;

  return new;
end;
$$;

-- 3. Índice no FK da fila de revisão ----------------------------------------------

create index idx_erros_entrega on erros_importacao (entrega_id);

-- 4. rls_auto_enable sem RPC público ----------------------------------------------

-- PUBLIC concedido por padrão: anon e authenticated herdam EXECUTE dele.
revoke execute on function public.rls_auto_enable() from public;
