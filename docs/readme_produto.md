# PlanOps — Planejamento e entregas

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
| Aprovação no e-mail, sem autor nem data | Aprovação por link, com nome, e-mail, data e observação |
| Nada de histórico | Histórico de mudanças por entrega, com autor |
| Acesso aberto a quem tivesse a planilha | Login por convite, com quatro papéis: admin, gestor, operador e leitor |
| Dados duplicados e datas em quatro formatos | Importação normalizada, com fila de revisão e nada apagado |

**Números do diagnóstico:** 30,7% das 888 entregas comparáveis passaram do prazo
(mediana de 6 dias, P90 de 21). Conteúdo é o tipo com maior taxa (41,1%), seguido
de Análise (32,9%) e Relatório (15,9%). 71 entregas estão abertas com prazo
vencido hoje.

## O que ficou de fora

- **Notificação por WhatsApp** — o envio por **e-mail já está implementado** (link
  de aprovação ao cliente, aviso da decisão ao time e aviso de prazo vencido);
  falta apenas o canal WhatsApp.
- Exportação CSV e gráficos além dos indicadores de atraso.
- E-mail de comprovante ao cliente após a aprovação.
- Integração com o calendário.

## Decisões que valem registro

- **Fase e aprovação são dimensões separadas.** O `status` da planilha não
  respondia "onde está a entrega"; sem separar, não dá para saber o que está
  parado e por quê.
- **Nada é apagado em silêncio.** Duplicados e inconsistências vão para a fila
  de revisão, e a linha original fica preservada para auditoria.
- **Cliente aprova por link, sem login.** O token é de uso único por etapa e
  expõe apenas aquela entrega.
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