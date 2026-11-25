# Teste de acesso — leitor

**Usuário:** Leitor de Teste
**Credenciais:** enviadas à parte (não versionadas neste repositório público).
**Papel:** leitor

## Resultado

- ✅ Login OK (user id 2f1fe828-6a3c-4996-9d7c-fcc3b914737a)
- ✅ Leitura de entregas OK (1007 linhas)
- ✅ Leitura de usuários: 1 registro(s) visível(is) [leitor]
- ✅ Escrita em entregas bloqueada pelo RLS (esperado para leitor): new row violates row-level security policy for table "entregas"

## O que este papel pode fazer (resumo)

- Login na plataforma: sim.
- Ler entregas: sim (todos os papéis).
- Ler a lista de usuários: apenas o próprio.
- Criar/editar entregas: não.
- Excluir entregas: não.

---
_Gerado por scripts/testar-papeis.mjs em 2026-11-25T05:02:25.475Z_
