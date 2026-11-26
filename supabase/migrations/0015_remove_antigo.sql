-- ============================================================================
-- PlanHub — Migration 15: remove o modelo antigo
--
-- Roda depois da migration 13 validar as contagens. A partir daqui o modelo
-- estrela (entregas, eventos_entrega, aprovacoes + dimensões) é a única fonte.
-- ============================================================================

drop table if exists public.erros_antigo cascade;
drop table if exists public.entregas_antigo cascade;
drop table if exists public.clientes_antigo cascade;