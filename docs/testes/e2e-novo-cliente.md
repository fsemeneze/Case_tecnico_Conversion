# Teste E2E — novo cliente, planejamento, entrega e aprovação

**Data:** 2026-11-25T05:10:27.489Z
**Cliente de teste:** Cliente E2E 2026-11-25T05-10-19 (id 26)
**Entrega de teste:** Entrega E2E 2026-11-25T05-10-19 (id 1031)

## Passo a passo e resultado

- ✅ 1. Cliente cadastrado: "Cliente E2E 2026-11-25T05-10-19" (id 26)
- ✅ 2. Entrega criada: "Entrega E2E 2026-11-25T05-10-19" (id 1031), fase solicitada, prazo 2026-12-05
- ✅ 3. Link de planejamento gerado e página OK (etapa 1 de 2, com conteúdo): https://planops-co.vercel.app/aprovacao/39a812d7-afed-4d62-8c72-1fb0060e992c
- ✅ 4. Cliente aprovou o planejamento -> fase "em_producao" (esperado em_producao)
- ✅ 5. Link de entrega gerado e página OK (etapa 2 de 2): https://planops-co.vercel.app/aprovacao/9bd7537e-3346-439b-84e0-73a93458df99
- ✅ 6. Cliente aprovou a entrega -> fase "aprovada" (esperado aprovada)
- ✅ 7. Estado final confere: fase=aprovada, planejamento=aprovada, entrega=aprovada
- ✅ 8. Aprovações registradas: 2 (esperado 2 — planejamento e entrega)
- ✅ 9. Histórico de eventos: 2 (mudanças de fase registradas)
- ✅ 10. Portal do cliente OK: mostra "Cliente E2E 2026-11-25T05-10-19" e a entrega aprovada: https://planops-co.vercel.app/cliente/a11a2e99-98f1-4d05-8071-ed679f69d34e

## Links gerados (validade 7 dias; portal 90 dias)

- Planejamento: https://planops-co.vercel.app/aprovacao/39a812d7-afed-4d62-8c72-1fb0060e992c
- Entrega: https://planops-co.vercel.app/aprovacao/9bd7537e-3346-439b-84e0-73a93458df99
- Portal do cliente: https://planops-co.vercel.app/cliente/a11a2e99-98f1-4d05-8071-ed679f69d34e

## Trecho renderizado da página de aprovação (planejamento)

> PlanOps — Planejamento e entregas PlanOps Entrega E2E 2026-11-25T05-10-19 Cliente E2E 2026-11-25T05-10-19 · Análise · etapa 1 de 2: planejamento Prazo 2026-12-05 Ver conteúdo da entrega Como você quer seguir? Esta revisão é sobre o planejamento do conteúdo . A

## Trecho renderizado do portal do cliente

> PlanOps — Planejamento e entregas PlanOps Cliente E2E 2026-11-25T05-10-19 Acompanhamento do projeto · somente leitura 1 Entregas 0 Em atraso 0 Em aberto 1 Aprovadas Entrega Tipo Fase Prazo Situação Conteúdo Entrega E2E 2026-11-25T05-10-19 Análise · Análise não

## Conclusão

O fluxo completo funcionou: cadastro do cliente, criação da entrega, aprovação do
planejamento (fase -> em_producao), aprovação da entrega (fase -> aprovada),
duas aprovações registradas com autor/data e histórico de eventos. O portal do
cliente lista a entrega aprovada.

---
_Gerado por scripts/teste-e2e-cliente.mjs._
