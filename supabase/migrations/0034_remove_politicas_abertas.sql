-- ============================================================================
-- PlanHub — Migration 34: remove as políticas antigas de SELECT/UPDATE
--
-- As políticas "entrega_select" e "entrega_update" (singular, da migration 8)
-- eram permissivas e continuavam ativas: no Postgres, políticas permissivas
-- se combinam com OR, então a regra antiga (qualquer usuário ativo) abria
-- todas as entregas e anulava a regra por squad da migration 33.
-- ============================================================================

drop policy if exists "entrega_select" on public.entregas;
drop policy if exists "entrega_update" on public.entregas;