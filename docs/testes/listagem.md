# Teste — Listagem de entregas (filtros, busca e paginação)

- ✅ Baseline: 1008 entregas (página 1 com 50)
- ✅ Busca "Relatório": 303 resultados, todos os títulos contêm o termo
- ✅ Busca inexistente: 0 (esperado 0)
- ✅ Filtro por cliente (10): 42 entregas, todas do cliente
- ✅ Filtro por fase "aprovada": 800, todas aprovadas
- ✅ Filtro por tipo "Conteúdo": 456, todas Conteúdo
- ✅ Filtro "atrasadas": 334, todas em atraso pela definição D8
- ✅ Filtro "vencidas": 71, todas abertas com prazo vencido
- ✅ Paginação: páginas 1 e 2 com 10 itens e ids distintos
- ✅ Filtro combinado (cliente + tipo): 20 entregas

---
_Gerado por scripts/testar-mais.mjs em 2026-11-25T09:45:14.573Z_
