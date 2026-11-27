-- ============================================================================
-- PlanHub — Migration 39: squad no convite e vínculo do usuário
--
-- O convite passa a guardar o squad escolhido pelo admin. O vínculo efetivo
-- acontece quando o usuário existe (usuario.squad_id), e o admin pode alterar
-- o squad de qualquer usuário existente pela tela de equipe.
-- ============================================================================

alter table public.convite
  add column if not exists squad_id bigint references public.squads (id);

-- Atualiza o vínculo de quem já está na casa: pessoas com usuário e sem
-- squad recebem o squad do convite (quando houver).
update public.usuario u
set squad_id = c.squad_id
from public.convite c
where c.email = u.email
  and c.squad_id is not null
  and u.squad_id is null
  and c.usado_em is not null;