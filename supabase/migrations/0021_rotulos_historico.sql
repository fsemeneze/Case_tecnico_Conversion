-- ============================================================================
-- PlanOps — Migration 21: rótulos legíveis do histórico
--
-- Os eventos criados pela importação inicial tinham autor "Importação da
-- planilha" e tipo "importacao" exibidos como código cru. Esta migration
-- padroniza o autor para um nome neutro. Os rótulos de exibição vivem em
-- lib/eventos.ts (a UI não mostra códigos).
-- ============================================================================

update public.eventos_entrega
set autor = 'Importação'
where autor = 'Importação da planilha';
