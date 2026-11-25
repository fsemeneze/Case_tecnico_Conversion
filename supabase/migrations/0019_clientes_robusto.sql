-- ============================================================================
-- PlanOps — Migration 19: cadastro de clientes mais robusto
--
-- Acrescenta dados de contato e identificação ao cliente, com dados fictícios
-- para o case. Clientes existentes são preenchidos; nada é apagado.
-- ============================================================================

alter table public.clientes
  add column if not exists nome_fantasia text,
  add column if not exists cnpj text,
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists contato_nome text,
  add column if not exists observacoes text,
  add column if not exists ativo boolean not null default true,
  add column if not exists atualizado_em timestamptz not null default now();

create unique index if not exists idx_clientes_cnpj
  on public.clientes (cnpj) where cnpj is not null;

-- Preenche dados fictícios plausíveis para os clientes já existentes.
update public.clientes
set
  nome_fantasia = coalesce(nome_fantasia, nome),
  cnpj = coalesce(cnpj, '00.000.000/0001-' || lpad((id % 10000)::text, 4, '0')),
  email = coalesce(email, 'contato' || id || '@exemplo.com.br'),
  telefone = coalesce(telefone, '(11) 4' || lpad((id % 1000000)::text, 7, '0')),
  cidade = coalesce(cidade, (array['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'])[(id % 5) + 1]),
  uf = coalesce(uf, (array['SP', 'RJ', 'MG', 'PR', 'RS'])[(id % 5) + 1]),
  contato_nome = coalesce(contato_nome, 'Contato ' || id),
  atualizado_em = now()
where cnpj is null or email is null or cidade is null;