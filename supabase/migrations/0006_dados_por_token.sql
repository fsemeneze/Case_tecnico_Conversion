-- ============================================================================
-- Fase 3 — Migration 6: dados da entrega pendente, resolvidos pelo token
--
-- A página pública /aprovacao/[token] precisa mostrar QUAL entrega está
-- sendo aprovada (título, cliente, datas) sem login. Como os tokens não têm
-- política de RLS (ninguém os lê direto), a leitura também passa por
-- função SECURITY DEFINER no schema privado — mesma porta do
-- registrar_aprovacao, agora para consulta. Não devolve nada além da
-- entrega do token, e nada de dados do banco fora dela.
-- ============================================================================

create or replace function aprovacao_priv.dados_entrega_por_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = aprovacao_priv, public
as $$
declare
  v_hash text;
  v_token_id uuid;
  v_etapa etapa_aprovacao;
  v_entrega public.entregas;
  v_cliente text;
  v_aprov_planej status_aprovacao;
  v_aprov_entrega status_aprovacao;
begin
  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select t.id, t.etapa
    into v_token_id, v_etapa
  from aprovacao_priv.aprovacao_tokens t
  where t.token_hash = v_hash
    and t.expira_em > now()
    and t.usado_em is null;

  if v_token_id is null then
    raise exception 'Token inválido, expirado ou já utilizado.';
  end if;

  select e.*
    into v_entrega
  from public.entregas e
  where e.id = (select entrega_id from aprovacao_priv.aprovacao_tokens where id = v_token_id);

  select c.nome
    into v_cliente
  from public.clientes c
  where c.id = v_entrega.cliente_id;

  v_aprov_planej := v_entrega.aprovacao_planejamento;
  v_aprov_entrega := v_entrega.aprovacao_entrega;

  return jsonb_build_object(
    'entrega_id', v_entrega.id,
    'titulo', v_entrega.titulo,
    'tipo', v_entrega.tipo,
    'cliente', v_cliente,
    'etapa', v_etapa,
    'data_prevista', v_entrega.data_prevista,
    'num_revisoes', v_entrega.num_revisoes,
    'aprovacao_planejamento', v_aprov_planej,
    'aprovacao_entrega', v_aprov_entrega
  );
end;
$$;

revoke all on function aprovacao_priv.dados_entrega_por_token(text) from public;

grant execute on function aprovacao_priv.dados_entrega_por_token(text)
  to service_role;
