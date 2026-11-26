-- ============================================================================
-- PlanHub — Migration 26: normalização das grafias de cliente (aliases)
--
-- A carga original guardou aliases com quatro defeitos:
--   1. Alias idêntico ao nome canônico (ex.: "Academia Força" → "Academia
--      Força") — não é grafia, é redundância.
--   2. Variação que difere só por case, acento ou espaço nas bordas (ex.:
--      "loja alfa", "Loja Alfa ", "TechNova" vs "Technova").
--   3. Duplicatas entre si com acento/case diferente.
--   4. Prefixo do nome canônico ("Vértice Saúde" ⊂ "Grupo Vértice Saúde") —
--      resíduo de normalização agressiva, não grafia usada na planilha.
--
-- Resultado na base do case: 32 aliases → 1 ("Loja Alfa Ltda", para o
-- canônico "Loja Alfa"). A linha original de cada entrega continua
-- preservada em entregas.origem_linha e a base bruta em dados/ — nada é
-- apagado sem cópia (D4).
--
-- Segurança: grafa_normalizada() é IMMUTABLE e só leitura; os deletes são
-- idempotentes e seguros de rodar de novo.
-- ============================================================================

-- Comparação canônica de grafia: minúsculas, sem acentos, sem espaços
-- redundantes. Cobre a base portuguesa sem exigir a extensão unaccent.
create or replace function public.grafia_normalizada(p_texto text)
returns text
language sql
immutable
set search_path = public
as $fn$
  select regexp_replace(
    translate(lower(btrim(coalesce(p_texto, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÛÜÇÑÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'),
    '\s+', ' ', 'g')
$fn$;

-- 1. Dedup antes do trim: iguais canônicos, fica o de menor id.
delete from public.aliases_cliente a
using public.aliases_cliente b
where a.cliente_id = b.cliente_id
  and a.id > b.id
  and public.grafia_normalizada(a.grafia) = public.grafia_normalizada(b.grafia);

-- 2. Trim nas bordas (o espaço à direita quebra comparação e filtro).
update public.aliases_cliente
set grafia = btrim(grafia)
where grafia <> btrim(grafia);

-- 3. Remove alias idêntico ao nome canônico do próprio cliente.
delete from public.aliases_cliente a
using public.clientes c
where a.cliente_id = c.id
  and public.grafia_normalizada(a.grafia) = public.grafia_normalizada(c.nome);

-- 4. Dedup pós-trim.
delete from public.aliases_cliente a
using public.aliases_cliente b
where a.cliente_id = b.cliente_id
  and a.id > b.id
  and public.grafia_normalizada(a.grafia) = public.grafia_normalizada(b.grafia);

-- 5. Remove prefixo/sufixo trivial do canônico.
--    Ex.: "Vértice Saúde" para o canônico "Grupo Vértice Saúde".
delete from public.aliases_cliente a
using public.clientes c
where a.cliente_id = c.id
  and (
    public.grafia_normalizada(c.nome) like public.grafia_normalizada(a.grafia) || ' %'
    or public.grafia_normalizada(c.nome) like '% ' || public.grafia_normalizada(a.grafia)
  );