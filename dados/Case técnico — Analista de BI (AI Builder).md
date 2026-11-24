# **Case técnico — Analista de BI (AI Builder)**

Nov, 2026

## **Boas-vindas**

Obrigado por seguir no processo para Analista de BI (AI Builder) no time de BI & Tecnologia da Conversion. Este case simula o trabalho real da vaga: entender um processo a partir de dados não estruturados, tirar esse processo de uma planilha e transformá-lo em uma aplicação, e tomar decisões de produto no caminho.

Não existe resposta única. Vamos avaliar como você pensa, decide e explica, mais do que a quantidade de coisas entregues.

| O que avaliamos | Como aparece no case |
| :---- | :---- |
| Leitura de dados | Diagnóstico da planilha |
| Modelagem e engenharia | Schema, regras e fatia funcional do app |
| Senso de produto | O que migrar, o que mudar e o que priorizar |
| Comunicação | README e vídeo de apresentação |

## **Contexto**

Neste cenário simulado, a **Conversion** presta serviços de SEO para cerca de 25 clientes e controla todas as entregas numa planilha interna, preenchida à mão por cerca de 10 analistas divididos em squads.

As entregas têm três tipos principais:

* **Relatório:** relatório mensal de desempenho enviado a cada cliente  
* **Análise:** diagnósticos pontuais (técnica, concorrência, palavras-chave)  
* **Conteúdo:** artigos e páginas produzidos para o site do cliente

O cliente participa em dois momentos: aprova o planejamento da entrega e, depois, a entrega completa. Com o crescimento da agência, três dores apareceram:

1. **Atrasos:** ninguém sabe com segurança o que está atrasado nem por quê.  
2. **Pouca rastreabilidade:** não dá para saber o que aconteceu com cada entrega ao longo do tempo.  
3. **Cliente sem visibilidade:** o cliente pergunta por e-mail em que pé está cada entrega.

A diretoria decidiu sair da planilha para um app. Você foi chamado para entender o processo pelos dados, propor como o app deve funcionar e construir a primeira versão.

## **Material recebido**

Você recebe o arquivo **controle\_entregas.xlsx**, uma exportação da planilha de controle de entregas com cerca de 1.000 linhas (nov/2025 a out/2026). Os dados são fictícios, mas foram preenchidos como uma equipe real preencheria.

| Coluna | O que deveria conter |
| :---- | :---- |
| id | Identificador da linha |
| cliente | Nome do cliente |
| tipo\_entrega | Relatório, Análise ou Conteúdo |
| titulo | Descrição curta da entrega |
| squad | Squad responsável |
| responsavel | Analista responsável |
| data\_solicitacao | Quando a entrega foi pedida |
| data\_prevista | Prazo combinado com o cliente |
| data\_entrega | Quando foi enviada ao cliente |
| status | Situação atual da entrega |
| aprovado\_planejamento | Se o cliente aprovou o planejamento |
| aprovado\_entrega | Se o cliente aprovou a entrega completa |
| num\_revisoes | Número de revisões da entrega |
| link | Link do arquivo entregue |
| observacoes | Anotações livres da equipe |

## **O que entregar**

São quatro entregáveis. Estimamos cerca de 6 horas de trabalho. Se não der tempo de fazer tudo, priorize e explique o que ficou de fora e por quê: isso também é avaliado.

1. **Diagnóstico dos dados**  
   * Diagnóstico sobre a base de dados recebida.  
2. **Modelagem**  
   * Schema em Postgres (Supabase)  
3. **Fatia funcional do app**  
   * Lista de entregas com filtros e busca  
   * Fluxo de aprovação pelo cliente, do planejamento à entrega completa.  
   * Cadastro de novas e entregas  
   * E outras funcionalidades que achar necessário  
4. **README de produto (até 1 página)**  
   * O que migrou igual da planilha, o que mudou e o que ficou de fora.  
   * Qual seria a próxima entrega do app e por quê.  
   * Como você usou IA no trabalho.

## **Stack sugerida e uso de IA**

Tudo pode ser feito sem custo. A stack abaixo é uma sugestão; se preferir outra, explique a escolha no README.

| Camada | Sugestão gratuita | Observação |
| :---- | :---- | :---- |
| Banco e autenticação | Supabase (plano Free) | Projetos gratuitos pausam após 1 semana sem uso: mantenha o projeto ativo durante a avaliação |
| Front-end | Next.js | Open source |
| Deploy | Vercel (plano Hobby) | Publique o app ou envie o necessário para rodarmos localmente (ver Formato de entrega) |
| Código | GitHub | Repositório público ou privado com convite para os avaliadores |
| Agente de código com IA | OpenAI Codex (ChatGPT Free), GitHub Copilot Free, Antigravity CLI ou OpenCode | Planos gratuitos têm cota; pode combinar ferramentas |

**O uso de IA é liberado e recomendado.** É assim que o time trabalha. O que pedimos:

* Declare no README quais ferramentas usou e para quê.  
* Entenda o que foi gerado: você precisa conseguir explicar e alterar sua entrega.  
* Se a cota gratuita acabar, tudo bem terminar parte à mão. Não é preciso pagar por nenhuma ferramenta.

## **Formato de entrega e prazo**

Você tem **5 dias corridos** a partir do recebimento deste material. Envie para o contato de People que te mandou o case ([carla.prates@conversion.com.br](mailto:carla.prates@conversion.com.br)):

* **Repositório:** código, modelagem, queries e README. Compartilhar com:  
  * leonan.sacchi@conversion.com.br  
  * nicolas.simionato@conversion.com.br  
* **Diagnóstico dos dados:** no README, em um notebook ou em um PDF curto, como preferir  
* **Vídeo de 5 a 10 minutos** apresentando a aplicação  
* **Acesso para teste:** o time precisa conseguir testar a ferramenta. Envie o link da aplicação publicada com usuários de teste para cada perfil, o repositório e as variáveis de ambiente e os passos para rodarmos localmente. Use apenas chaves de um projeto criado para o case, nunca credenciais pessoais ou de outros projetos.

Depois de avaliar a entrega, People entra em contato com o retorno e os próximos passos do processo.

## **Dúvidas frequentes**

**Posso fazer perguntas durante o case?** Pode, por e-mail para People. Se a dúvida for sobre como interpretar um dado, prefira decidir, registrar a premissa e seguir: é o que faríamos no dia a dia.

**Os dados são reais?** Não. São fictícios, criados para este case. Nenhum dado de cliente da Conversion é usado.

**O que acontece com meu código?** Ele é seu. Usamos apenas para avaliação neste processo seletivo.