-- ============================================================================
-- PlanHub — Migration 32: remove o formulário de data inferida
--
-- A decisão D17 passou a aceitar a inferência em bloco; a correção pontual
-- é feita na própria entrega. A função criada na migration 31 ficou sem uso
-- e é removida aqui.
-- ============================================================================

drop function if exists public.confirmar_data_inferida(bigint, text, date);