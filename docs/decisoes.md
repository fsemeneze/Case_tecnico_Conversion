# Decisões e premissas

Registro das decisões tomadas durante o case, com o motivo e a alternativa
descartada. Serve para o avaliador entender o raciocínio, não só o resultado.

## D1. Stack

**Decisão:** Supabase (Postgres + Auth + RLS), Next.js (App Router) e Vercel.

**Por quê:** é a stack sugerida no case e cobre o que a vaga pede (Postgres/Supabase,
migrations, RLS, deploy). Tudo no plano gratuito.

**Alternativa descartada:** SQLite + deploy estático. Mais simples, mas não exercita
RLS, Auth nem o fluxo de ambientes que a vaga valoriza.

## D2. Separar fase de aprovação

**Decisão:** o campo `status` da planilha vira duas dimensões:
`fase` (andamento) e `aprovacao_planejamento` / `aprovacao_entrega` (decisão do cliente).

**Por quê:** a base mistura "Em produção", "Aguardando cliente" e "aprovado pelo cliente"
no mesmo campo. Sem separar, não dá para responder "o que está parado e por quê".

**Fases:** `solicitada`, `em_producao`, `aguardando_cliente`, `aguardando_aprovacao_entrega`,
`ajuste_solicitado`, `entregue`, `aprovada`, `cancelada`.

**Alternativa descartada:** manter um enum único com todos os valores antigos. Preserva
a planilha, mas perpetua a ambiguidade.

## D3. Cliente aprova por link com token, sem login

**Decisão:** o cliente não tem conta. Recebe um link com token único por entrega e por
etapa, que só permite aprovar/recusar aquela entrega.

**Por quê:** a dor é "o cliente pergunta por e-mail". Criar login para 25 clientes
aumenta atrito e superfície de segurança. O token resolve com uma função `SECURITY DEFINER`
que expõe somente a entrega do token.

**Cuidados:** token com expiração, uso único por etapa, registro de autor (nome/e-mail
informado na hora), e nada além da entrega é retornado.

**Endurecimento (D11):** e-mail obrigatório, IP e user-agent registrados, link
novo revoga o anterior e o portal abre a aprovação pendente sem depender do
time.

## D4. Não apagar duplicados: fila de revisão

**Decisão:** IDs repetidos e registros com assinatura idêntica são importados e marcados
com `flags`, e aparecem em `erros_qualidade.csv` e na `importacao_legado`.

**Por quê:** 12 IDs aparecem duas vezes e os IDs 986 a 995 replicam entregas existentes
com outro número. Apagar exige decisão humana; importar em silêncio esconde o problema.
A importação preserva a linha original em JSON para auditoria.

## D5. Normalização de datas

**Decisão:** aceitar quatro formatos (dd/mm/aaaa, ISO, serial do Excel, "dd/mês"),
normalizar para `DATE` e registrar a observação. Quando o texto não tem ano, inferir
o ano pela data mais próxima da solicitação.

**Por quê:** 1.007 linhas com 887 em dd/mm/aaaa, 26 em ISO, 37 em serial e 41 em texto
curto. Sem normalizar, 30% da base não entra em cálculo de atraso.

**Limite:** a inferência de ano é uma premissa; linhas afetadas ficam sinalizadas com
`data_*_texto_ano_inferido` para conferência.

## D6. Aprovação vazia em relatório = não se aplica

**Decisão:** em `tipo = Relatório`, aprovação de planejamento vazia vira `nao_aplica`.
Nos outros tipos, vazio vira `nao_informado`.

**Por quê:** relatórios mensais não têm etapa de planejamento na operação descrita; os
demais vazios podem ser falta de preenchimento. Separar os dois evita métrica falsa.

## D7. "ok"/"aprovado" sem aprovação explícita = entregue

**Decisão:** se o status diz "aprovado"/"ok"/"finalizado" mas a coluna de aprovação de
entrega não confirma, a entrega fica `entregue` e recebe a flag
`status_aprovado_sem_aprovacao`.

**Por quê:** "ok" é usado para as duas coisas na planilha. A coluna de aprovação é a
evidência mais forte. O contrário (aprovação registrada mas status anterior) também é
sinalizado, sem sobrescrever o status declarado.

## D8. Definição de atraso

**Decisão:**
- Entrega concluída: `data_entrega > data_prevista`.
- Em aberto: `data_prevista < hoje` e fase não final nem cancelada.
- Não comparável quando falta uma das datas.

**Por quê:** é a única definição que a base permite calcular e que responde à dor 1.
Fica registrada para que o número do app bata com o do diagnóstico.

## D9. Subtipo derivado do título

**Decisão:** o tipo é normalizado para Relatório, Análise ou Conteúdo; o subtipo de
Análise é extraído do título (Core Web Vitals, Backlinks, Indexação, Concorrência,
Mapeamento de conteúdo, Palavras-chave, Auditoria técnica).

**Por quê:** a planilha usa "Análise técnica" e "Auditoria" como tipos, mas o título é
quem diz o que foi feito. Sem subtipo, 248 análises viram uma caixa única.

## D10. Segredos e ambientes

**Decisão:** um projeto Supabase só para o case. `.env.example` no repositório, `.env*`
no `.gitignore`. Nenhuma credencial pessoal.

**Por quê:** exigência explícita do case e boa prática. O histórico do Git será revisado
antes do envio.

## D11. Endurecer o link em vez de criar conta de cliente

**Decisão:** manter o cliente sem conta (D3) e fechar as lacunas do link:
e-mail obrigatório na aprovação, origem (IP e user-agent) registrada, link novo
invalidando o anterior e portal que lista e abre as aprovações que o time já
colocou em aprovação (link ativo).

**Por quê:** o case pede visibilidade e duas decisões, não uma área logada. Conta
de cliente adiciona convite, senha, recuperação, suporte e uma credencial externa
para 25 clientes — custo e superfície de segurança sem ganho para a dor. O link
já responde "o cliente pergunta por e-mail", e o token tem escopo de uma entrega
(ou de um cliente, no portal).

**Quando rever:** se o cliente precisar de acesso recorrente com várias pessoas,
histórico longo, comentários ou exigência contratual de identidade autenticada.
Nesse caso, a forma certa é passwordless (magic link/OTP), não senha, com RLS por
`cliente_id`.

**Argumento completo para a apresentação:** `docs/acesso_cliente.md`.

## D12. Grafias de cliente: canônico no app, variações de verdade no alias

**Decisão:** a comparação de grafias ignora case, acento e espaços nas bordas —
"loja alfa", "Loja Alfa " e "Loja Alfa" são o mesmo cliente e não aparecem como
variação. A lista de clientes só mostra alias que difere de verdade do nome
canônico ("Loja Alfa Ltda" fica; "Vértice Saúde" para o canônico "Grupo Vértice
Saúde" saiu — prefixo, não grafia). A limpeza está na migration 0026
(32 aliases → 1) e o filtro, no app. A linha original de cada entrega segue
preservada em `origem_linha`, e a base bruta em `dados/`.

**Por quê:** o objetivo do alias é explicar por que duas grafias da planilha
apontam para o mesmo cliente — e variação de maiúscula ou espaço não explica
nada; só polui a tela e confunde filtro. Quem precisa da grafia exata de 2025
consulta a linha original, não o alias.

## D13. Encerramento de entregas paradas

**Decisão:** entrega aberta e vencida há mais de 90 dias entra na fila de
encerramento (na tela de Revisão de dados). O time decide entre três saídas,
sempre com motivo obrigatório e registro no histórico:

- **Retomar** — volta para produção com novo prazo combinado;
- **Entregar** — conclui com o atraso registrado;
- **Cancelar** — encerra como cancelada, com motivo.

Aos 30 dias, o lembrete de prazo vencido (D — notificação) já avisa cliente e
gestor. Nada é apagado: a linha original, as aprovações e os eventos ficam
(D4), e o cancelamento não apaga o atraso — o indicador continua contando.

**Por quê:** 72 entregas abertas vencidas (25 com mais de 90 dias, maior atraso
363 dias) mostram que "em aberto" eterno não é estado, é dívida. Sem uma fila
com decisão humana, a lista só cresce e o número de atraso perde credibilidade.
Cancelar em massa por regra seria o "apagar em silêncio" que o case proíbe;
por isso a saída é uma fila com dono, prazo e motivo.

## D14. Concluída sem data de entrega: o time preenche, o app nunca inventa

**Decisão:** as 15 entregas com status final e `data_entrega` em branco (flag
`concluida_sem_data_entrega`) entram na fila de revisão da importação. O time
preenche a data real — ou confirma "não sei". Ao preencher, o app corrige a
entrega, recalcula os indicadores e registra evento no histórico. A data
inferida (fallback pela prevista) **não** é gravada no banco: sem preenchimento,
a entrega segue fora dos comparáveis, com a flag visível. A sujeira continua
registrada no diagnóstico (o normalizador não muda).

**Por quê:** a data de entrega é o que torna o atraso e o ciclo mensuráveis;
inventá-la (fallback silencioso) contaminaria o indicador que o avaliador vai
olhar. Em 15 casos, o certo é a decisão humana — e o "não sei" também é uma
resposta válida, que fecha o item sem mentir o dado.

## D15. Entrega sem link de arquivo: o time preenche ou confirma ausência

**Decisão:** as 62 entregas sem `link` (arquivo de entrega) entram na fila de revisão da importação. O time preenche o link real ou confirma que não tem arquivo. Ao preencher, o app grava o link na entrega e registra evento no histórico. A flag `sem_link` continua visível no diagnóstico até ser resolvida.

**Por quê:** o link de arquivo é o conteúdo da entrega — sem ele, o cliente não recebe nada pelo portal e a aprovação perde sentido. Em 62 casos, o certo é a decisão humana: preencher ou registrar formalmente que não existe arquivo (por exemplo, entregas canceladas ou entregues por outro canal). Nada é apagado nem inventado.

## D16. Link textual ("no e-mail", "ver drive"): URL real ou confirmação de ausência

**Decisão:** as 20 entregas com texto no campo `link` em vez de URL entram na
fila de revisão. O time informa a URL real (substitui o texto) ou confirma que
não há arquivo (o campo é limpo e a entrega passa para a fila de "sem link").
Um link `http(s)` válido nunca é sobrescrito.

**Por quê:** "ver drive" não é link — o cliente não consegue abrir, e o portal
mostraria um texto morto. A decisão é a mesma da D15, com a diferença de que
aqui existe um valor para substituir, não um vazio.

## D17. Ano inferido em data curta: aceitar a inferência

**Decisão:** as 40 entregas com data curta ("10/nov") sem ano — 17 na prevista,
15 na entrega, 8 na solicitação — ficam com a data que o normalizador inferiu
(D5) e a flag é removida. A inferência é aceita em bloco: ela acerta quando o
ano está ancorado na solicitação ou no título ("Relatório mensal 11/2025").
Quem discordar de uma data corrige na própria entrega.

**Por quê:** confirmar 40 linhas uma a uma custa mais do que o ganho; a
inferência é determinística e auditável (a regra está em `docs/decisoes.md` e
no notebook). O que não pode é a flag ficar eterna sem dono.

## Premissas

1. Os dados são fictícios, mas as inconsistências são tratadas como sujeira real.
2. Datas em nov/2026 estão fora da janela declarada (nov/2025 a out/2026) e ficam
   mantidas com sinalização.
3. "Em andamento" e "fazendo" equivalem a `em_producao`.
4. "Com o cliente" e "Entrega em aprovação" equivalem a `aguardando_aprovacao_entrega`.
5. O valor 99 em `num_revisoes` é erro de digitação (não 99 revisões) e vira nulo com flag.
6. Cancelamento no texto livre (`observacoes`) prevalece sobre status de produção.
7. A data de referência do diagnóstico é a data de execução do script.

## Pendências conhecidas

- Gravar o vídeo de demonstração (Fase 5).
- Definir identidade visual mínima; não é critério do case.
