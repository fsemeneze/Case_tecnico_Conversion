# Acesso do cliente: por que link e não conta

Documento de apoio para a apresentação. Registra a decisão **D3 + D11** em
`docs/decisoes.md`: o cliente continua sem conta no PlanHub, e o link foi
endurecido para cobrir rastreabilidade e descoberta.

## O pedido do case

- **Dor declarada:** "Cliente sem visibilidade: o cliente pergunta por e-mail em
  que pé está cada entrega."
- O cliente participa em **dois momentos**: aprova o planejamento e, depois, a
  entrega completa.
- Entregável: fluxo de aprovação do planejamento à entrega completa.
- "Usuários de teste para cada perfil" são os **quatro papéis internos** (admin,
  gestor, operador, leitor). O cliente não é um perfil do sistema.

## A decisão em uma frase

> O cliente não precisa de conta para ver o andamento nem para decidir: recebe
> um link com escopo, e o próprio portal mostra o que está esperando por ele.

## Link x conta: o comparativo

| Critério | Link com token (escolhido) | Conta de cliente |
| :--- | :--- | :--- |
| Resolve a dor 3 (visibilidade) | Sim, portal read-only por cliente | Sim |
| Resolve as duas aprovações | Sim, token por entrega + etapa | Sim |
| Atrito para o cliente | Nenhum: abre o link | Convite, senha, recuperação |
| Operação para a agência | Gera e envia o link | Gerencia contas, reset e suporte |
| Rastreabilidade | Nome, e-mail, data, observação, IP e user-agent | Identidade autenticada |
| Superfície de segurança | Token hasheado, escopo mínimo, expiração, uso único | Credencial externa para 25 clientes |
| Esforço no case (~6h) | Já implementado | ~1 dia só de autenticação |
| Teste pelo avaliador | Abre o link, sem criar conta | Precisa de conta por cliente |

## Por que não criar conta (seis argumentos)

1. **Não é o que o case pede.** O pedido é visibilidade e duas decisões, não uma
   área logada. Criar conta resolve um problema que ninguém declarou.
2. **O atrito é real e recorrente.** Conta significa convite, senha, recuperação
   e suporte. Na agência, o contato do cliente muda; o link acompanha isso sem
   administração.
3. **Segurança proporcional.** Hoje o acesso é mínimo por construção: token
   guardado como `sha256`, escopo de uma entrega (ou de um cliente), expiração e
   uso único. Uma conta externa adiciona credencial para 25 clientes, com
   enumeração, força bruta e política de senha/MFA a manter.
4. **Cabe no prazo.** O case estima ~6h e valoriza priorizar. Autenticação de
   cliente consome o tempo que rende mais na fatia pedida.
5. **A avaliação fica mais fácil.** Os avaliadores testam os quatro perfis
   internos; o fluxo do cliente é demonstrável na hora, por link.
6. **A prova da decisão já existe.** "Quem decidiu o quê e quando" está
   registrado com nome, e-mail, data, observação e origem.

## O que foi endurecido no lugar da conta

1. **E-mail obrigatório** na aprovação — antes era opcional.
2. **IP e user-agent** gravados em `aprovacoes.autor_ip` e
   `aprovacoes.autor_user_agent`; o IP aparece no detalhe da entrega.
3. **Link novo revoga o anterior**: gerar outro link de aprovação (mesma entrega
   e etapa) ou outro link de portal (mesmo cliente) invalida o antigo na hora,
   em vez de deixar dois válidos até expirarem.
4. **Portal lista as aprovações pendentes** e abre o link de aprovação. Só
   aparece o que o time já colocou em aprovação (link ativo) e cuja decisão
   ainda está pendente; a função `criar_token_aprovacao_portal` exige esse link
   ativo antes de emitir um novo. Ou seja: o cliente ganha descoberta, mas não
   consegue adiantar uma aprovação. Ao abrir pelo portal, o link novo substitui
   o que foi enviado por e-mail — a regra de "link novo revoga o anterior" vale
   aqui também.

## Quando faria sentido ter conta

- O cliente precisa de **acesso recorrente** com várias pessoas do mesmo cliente.
- Histórico longo, comentários ou download em lote dentro do app.
- Exigência **contratual** de assinatura com identidade autenticada.
- Links sendo encaminhados ou caindo em spam, e a agência quer sessão estável.

**Se for o caso, a forma certa é passwordless:** magic link/OTP do Supabase (sem
senha), tabela `cliente_contatos` (cliente_id, e-mail, nome, ativo), sessão lendo
por RLS com o `cliente_id`, reaproveitando a função de dados do portal. Custo
realista: ~1 dia — fora do orçamento deste case.

## Frases para a apresentação

- "O cliente não é um usuário do sistema: ele é um **aprovador por link**. O
  sistema precisa provar quem aprovou, não manter uma sessão para ele."
- "Troquei 'criar login' por 'provar a origem': nome, e-mail, data, observação e
  IP ficam registrados na decisão."
- "O portal agora mostra o que está esperando o cliente e abre a aprovação — a
  dor de perguntar por e-mail deixa de existir sem criar 25 contas."
- "Se o cliente um dia precisar de área logada, o caminho é magic link, não
  senha; a decisão de hoje não fecha essa porta."

## Onde está no código

- Token de aprovação e portal: `supabase/migrations/0022_endurecimento_links.sql`
- Página de aprovação: `app/aprovacao/[token]/`
- Portal do cliente: `app/cliente/[token]/`
- Registro da origem: `app/(app)/entregas/actions.ts` (`aprovarViaToken`)
