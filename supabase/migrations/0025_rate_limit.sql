-- ============================================================================
-- PlanHub — Migration 25: limite de tentativas (login e aprovação)
--
-- Janela fixa por chave: cada chamada incrementa o contador; se a janela
-- expirou, o contador volta a 1. A chave é um hash (escopo + IP), nunca o
-- e-mail ou o IP em claro.
--
-- Segurança (skill supabase):
--   - Tabela no schema privado, RLS ligado e nenhuma política.
--   - Função SECURITY DEFINER com search_path fixado.
--   - EXECUTE revogado de PUBLIC/anon/authenticated: só o service_role chama.
-- ============================================================================

create table if not exists aprovacao_priv.rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contador integer not null default 1
);

alter table aprovacao_priv.rate_limits enable row level security;
revoke all on aprovacao_priv.rate_limits from anon, authenticated;

create or replace function public.verificar_rate_limit(
  p_chave text,
  p_limite integer,
  p_janela_segundos integer
)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $fn$
declare
  v_contador integer;
  v_inicio timestamptz;
begin
  if p_chave is null or btrim(p_chave) = '' then
    raise exception 'Chave de limite inválida.';
  end if;
  if p_limite < 1 or p_janela_segundos < 1 then
    raise exception 'Limite e janela devem ser positivos.';
  end if;

  insert into aprovacao_priv.rate_limits (chave, janela_inicio, contador)
  values (p_chave, now(), 1)
  on conflict (chave) do update
    set contador = case
          when aprovacao_priv.rate_limits.janela_inicio
               < now() - make_interval(secs => p_janela_segundos)
          then 1
          else aprovacao_priv.rate_limits.contador + 1
        end,
        janela_inicio = case
          when aprovacao_priv.rate_limits.janela_inicio
               < now() - make_interval(secs => p_janela_segundos)
          then now()
          else aprovacao_priv.rate_limits.janela_inicio
        end
  returning contador, janela_inicio
  into v_contador, v_inicio;

  return jsonb_build_object(
    'permitido', v_contador <= p_limite,
    'tentativas', v_contador,
    'limite', p_limite,
    'reinicia_em', v_inicio + make_interval(secs => p_janela_segundos)
  );
end;
$fn$;

revoke all on function public.verificar_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.verificar_rate_limit(text, integer, integer)
  to service_role;