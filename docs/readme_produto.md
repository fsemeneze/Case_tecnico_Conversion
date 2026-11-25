# PlanHub — Planejamento e entregas

**O que é.** O controle de entregas da Conversion saiu da planilha e virou um
app: lista com filtros e busca, cadastro de entregas e aprovação do cliente em
duas etapas, com histórico de quem decidiu o quê e quando.

**Para quem.** O time de operações (squads de conteúdo, análise e relatório) e
o cliente, que aprova pelo link sem precisar de conta.

**Link.** https://planops-co.vercel.app/login

---

## O que migrou igual

- As 1.007 entregas da planilha, com as datas originais e a linha da planilha
  preservada em cada registro.
- Os 25 clientes canônicos, com as 31 grafias originais guardadas como alias.
- A fila de revisão: 372 problemas encontrados na importação, 193 críticos.

## O que mudou

| Antes (planilha) | Agora (PlanOps) |
| :--- | :--- |
| 22 valores de status misturando produção, espera e aprovação | **Fase** (andamento) separada de **aprovação** (decisão do cliente) |
| Atraso não era medível | Atraso com definição única: concluída após o prazo ou em aberto com prazo vencido |
| Aprovação no e-mail, sem autor nem data | Aprovação por link, com nome, e-mail, data, observação e origem (IP) |
| Nada de histórico | Histórico de mudanças por entrega, com autor |
| Acesso aberto a quem tivesse a planilha | Login por convite, com quatro papéis: admin, gestor, operador e leitor |
| Dados duplicados e datas em quatro formatos | Importação normalizada, com fila de revisão e nada apagado |

**Números do diagnóstico:** 30,7% das 888 entregas comparáveis passaram do prazo
(mediana de 6 dias, P90 de 21). Conteúdo é o tipo com maior taxa (41,1%), seguido
de Análise (32,9%) e Relatório (15,9%). 71 entregas estão abertas com prazo
vencido hoje.

## O que ficou de fora

- **WhatsApp.** O e-mail existe no app (link de aprovação ao cliente, aviso da
  decisão ao time e aviso de prazo vencido), mas o provedor está em modo de
  teste, sem domínio verificado: ele só entrega ao e-mail da própria conta.
  Quando o envio não sai, a tela diz o motivo e mantém o link visível para
  copiar e mandar pelo canal de contato. Verificar um domínio no Resend resolve.
- Exportação CSV e gráficos além dos indicadores de atraso.
- E-mail de comprovante ao cliente após a aprovação.
- Integração com o calendário.

## Próxima entrega e por quê

**Escalonamento de aprovações paradas.** Hoje o app mostra o que está aguardando
o cliente, mas não age: a entrega fica parada até alguém lembrar de cobrar. A
próxima entrega transforma a espera em fila com prazo: a cada X dias sem
decisão, o cliente recebe um lembrete com o link reaberto e o gestor do squad
recebe um alerta com o tempo médio de decisão daquele cliente.

Por quê: o atraso nasce menos na execução e mais na espera. Das entregas
comparáveis, 30,7% passaram do prazo, com mediana de 6 dias; o trecho entre
"pronto para aprovação" e a decisão do cliente é justamente o que o time não
controla e hoje não consegue medir. O que a entrega precisa já existe — fase,
aprovação, link com validade e histórico com data e autor —, então o trabalho é
de regra e de tela, não de modelo novo. E o resultado é mensurável: dias até a
decisão por cliente e quantas entregas destravaram depois do lembrete.

## Decisões que valem registro

- **Fase e aprovação são dimensões separadas.** O `status` da planilha não
  respondia "onde está a entrega"; sem separar, não dá para saber o que está
  parado e por quê.
- **Nada é apagado em silêncio.** Duplicados e inconsistências vão para a fila
  de revisão, e a linha original fica preservada para auditoria.
- **Cliente aprova por link, sem login.** O token é de uso único por etapa e
  expõe apenas aquela entrega. A aprovação exige e-mail e registra origem (IP);
  um link novo invalida o anterior. O portal lista e abre as aprovações que o
  time colocou em aprovação, sem criar conta para o cliente.
- **Modelo em estrela.** Fatos (`entregas`, `eventos_entrega`, `aprovacoes`) e
  dimensões (`clientes`, `fases`, `calendario`…), com a regra de negócio no banco
  e RLS por papel.

## Uso de IA

Código, migrations, testes e este documento foram escritos com OpenCode (agente
de código) e revisados manualmente. Os pontos revisados: a inferência de ano em
datas abreviadas, o tratamento de revisões inválidas (`99`, `-1`, "duas") e a
decisão de não apagar duplicados. Um teste encontrou um bug real no normalizador
(um `-1` virava `1`) e foi corrigido antes de gerar a base final. Nenhuma decisão
de negócio foi delegada à IA.

---

**Contexto.** Case técnico para a vaga de Analista de BI Pleno (AI Builder) na
Conversion. Dados fictícios, criados para o case. Stack: Supabase (Postgres,
Auth, RLS), Next.js e Vercel.