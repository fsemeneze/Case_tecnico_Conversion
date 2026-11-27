-- ============================================================================
-- PlanHub — Migration 27: encerramento de entregas paradas (D13)
--
-- Entregas abertas e vencidas há mais de 90 dias entram numa fila de
-- encerramento. Nada é apagado: a decisão (retomar, entregar ou cancelar)
-- fica registrada com autor, data e motivo, e o histórico da entrega
-- continua no lugar (D4).
--
-- A elegibilidade é calculada na hora (fase aberta + prazo vencido há
-- mais de 90 dias + sem encerramento ativo) — sem tabela de fila
-- materializada, que só duplicaria o estado.
-- ============================================================================

-- Uma linha por decisão de encerramento. O cancelamento não apaga a entrega:
-- a fase vira 'cancelada' e o motivo fica aqui.
create table if not exists public.encerramentos (
  id uuid primary key default gen_random_uuid(),
  entrega_id bigint not null references public.entregas (id) on delete cascade,
  decisao text not null check (decisao in ('retomada', 'entregue', 'cancelada')),
  motivo text not null,
  autor_id uuid not null references auth.users (id),
  autor_nome text not null,
  dias_vencida integer not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_encerramento_entrega
  on public.encerramentos (entrega_id, criado_em desc);

alter table public.encerramentos enable row level security;
revoke all on public.encerramentos from anon;

create policy "encerramentos_select" on public.encerramentos
  for select to authenticated using (public.usuario_esta_ativo());

create policy "encerramentos_write" on public.encerramentos
  for all to authenticated
  using (public.papel_atual() in ('admin', 'gestor'))
  with check (public.papel_atual() in ('admin', 'gestor'));

-- ---------------------------------------------------------------------------
-- Encerrar uma entrega: retomar (volta para produção com prazo novo),
-- entregar (conclui) ou cancelar (encerra). Tudo numa transação, com
-- evento no histórico e registro do motivo.
-- ---------------------------------------------------------------------------

create or replace function public.encerrar_entrega(
  p_entrega_id bigint,
  p_decisao text,
  p_motivo text,
  p_novo_prazo date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_papel text;
  v_fase text;
  v_grupo text;
  v_prazo date;
  v_dias integer;
  v_autor uuid;
  v_nome text;
  v_fase_nova text;
begin
  v_papel := public.papel_atual();
  if v_papel not in ('admin', 'gestor') then
    raise exception 'Seu perfil não pode encerrar entregas.';
  end if;

  if p_decisao not in ('retomada', 'entregue', 'cancelada') then
    raise exception 'Decisão inválida.';
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'Informe o motivo do encerramento.';
  end if;

  select f.codigo, f.grupo, e.data_prevista_id
    into v_fase, v_grupo, v_prazo
  from public.entregas e
  join public.fases f on f.id = e.fase_id
  where e.id = p_entrega_id
  for update of e;

  if v_fase is null then
    raise exception 'Entrega não encontrada.';
  end if;
  if v_grupo <> 'aberta' then
    raise exception 'A entrega não está em fase aberta.';
  end if;

  v_dias := (current_date - v_prazo);
  if v_dias <= 90 then
    raise exception 'A entrega ainda não está vencida há mais de 90 dias.';
  end if;

  -- Só uma decisão ativa por entrega: o encerramento é a fila, não um
  -- histórico de tentativas. Reabrir é retomar com novo prazo.
  if exists (
    select 1 from public.encerramentos
    where entrega_id = p_entrega_id and decisao = 'cancelada'
  ) then
    raise exception 'A entrega já está cancelada.';
  end if;

  select id, nome into v_autor, v_nome
  from public.usuario where id = (select auth.uid());

  v_fase_nova := case p_decisao
    when 'retomada' then 'em_producao'
    when 'entregue' then 'entregue'
    else 'cancelada'
  end;

  if p_decisao = 'retomada' and p_novo_prazo is null then
    raise exception 'Informe o novo prazo para retomar.';
  end if;

  update public.entregas
  set fase_id = public.id_fase(v_fase_nova),
      data_prevista_id = case
        when p_decisao = 'retomada' then p_novo_prazo
        else data_prevista_id
      end,
      atualizado_em = now()
  where id = p_entrega_id;

  insert into public.encerramentos
    (entrega_id, decisao, motivo, autor_id, autor_nome, dias_vencida)
  values
    (p_entrega_id, p_decisao, btrim(p_motivo), v_autor, v_nome, v_dias);

  insert into public.eventos_entrega
    (entrega_id, tipo_evento, campo, valor_antigo, valor_novo, autor, origem_id)
  values
    (p_entrega_id, 'fase', 'fase', v_fase, v_fase_nova, v_nome,
     public.id_origem('app'));

  return jsonb_build_object(
    'entrega_id', p_entrega_id,
    'decisao', p_decisao,
    'fase', v_fase_nova,
    'dias_vencida', v_dias
  );
end;
$fn$;

revoke all on function public.encerrar_entrega(bigint, text, text, date)
  from public, anon, authenticated;
grant execute on function public.encerrar_entrega(bigint, text, text, date)
  to authenticated;