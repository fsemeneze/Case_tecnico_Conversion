-- ============================================================================
-- Fase 2 — Migration 3: histórico por trigger
--
-- Toda mudança em entregas gera linhas em entrega_historico (um registro por
-- campo alterado). O autor vem da variável de sessão `app.autor`, que o app
-- define em cada request (nome do usuário do time ou "Cliente via link").
-- A importação não gera histórico — ela é o estado inicial, não uma mudança.
-- ============================================================================

create or replace function entrega_historico_fn()
returns trigger
language plpgsql
as $$
declare
  v_antigo jsonb;
  v_novo jsonb;
  v_campo text;
  v_autor text;
begin
  v_autor := nullif(current_setting('app.autor', true), '');
  v_antigo := to_jsonb(old) - 'updated_at';
  v_novo := to_jsonb(new) - 'updated_at';

  for v_campo in select jsonb_object_keys(v_novo)
  loop
    -- Campos técnicos ficam fora do histórico.
    if v_campo in ('id', 'legacy_id', 'criado_em', 'origem_linha') then
      continue;
    end if;

    if v_antigo -> v_campo is distinct from v_novo -> v_campo then
      insert into entrega_historico (entrega_id, campo, valor_antigo, valor_novo, autor)
      values (
        new.id,
        v_campo,
        case v_antigo -> v_campo
          when 'null' then null
          else v_antigo ->> v_campo
        end,
        case v_novo -> v_campo
          when 'null' then null
          else v_novo ->> v_campo
        end,
        v_autor
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger entregas_historico
  after update on entregas
  for each row execute function entrega_historico_fn();
