# Diagnóstico dos dados — controle de entregas

Gerado automaticamente por `analysis/diagnostico.py` em 2026-11-26T21:51:40.
Arquivo de origem: `dados/controle_entregas.csv`.
Data de referência para "em atraso hoje": **2026-11-26**.

## 1. Visão geral

| Indicador | Valor |
| :--- | ---: |
| Linhas na base | 1007 |
| Linhas normalizadas | 1007 |
| Período das datas (solicitação e entrega) | 2025-11-01 a 2026-11-17 |
| Grafias de cliente | 31 |
| Clientes após normalização | 25 |
| Squads | 3 |
| Responsáveis | 10 |

## 2. Atraso — a dor principal

| Indicador | Valor |
| :--- | ---: |
| Entregas com prazo e data de entrega (comparáveis) | 888 |
| Entregas após o prazo | 273 |
| **Taxa de atraso** | **30,7%** |
| Mediana dos dias de atraso | 6 |
| P90 dos dias de atraso | 21 |
| Atraso máximo | 304 |
| Entregas sem data prevista | 47 |
| Entregas sem data de entrega | 74 |
| Entregas abertas com prazo vencido hoje | 71 |

### Distribuição do atraso (dias)

| Faixa | Entregas |
| :--- | ---: |
| 1 a 3 dias | 94 |
| 4 a 7 dias | 85 |
| 8 a 14 dias | 31 |
| 15 a 30 dias | 55 |
| 31+ dias | 8 |

### Por tipo de entrega

| Tipo | Entregas | Comparáveis | Atrasadas | Taxa |
| :--- | ---: | ---: | ---: | ---: |
| Relatório | 303 | 296 | 47 | 15,9% |
| Análise | 248 | 210 | 69 | 32,9% |
| Conteúdo | 456 | 382 | 157 | 41,1% |

### Por squad

| Squad | Entregas | Comparáveis | Atrasadas | Taxa |
| :--- | ---: | ---: | ---: | ---: |
| Squad Azul | 368 | 311 | 81 | 26,0% |
| Squad Verde | 333 | 300 | 120 | 40,0% |
| Squad Laranja | 306 | 277 | 72 | 26,0% |

### Clientes com mais entregas atrasadas

| Cliente | Entregas | Atrasadas |
| :--- | ---: | ---: |
| Grupo Vértice Saúde | 44 | 23 |
| Escola Saber Mais | 51 | 21 |
| Banco Prisma | 33 | 16 |
| Seguros Confia | 45 | 15 |
| Academia Força | 39 | 15 |
| Advocacia Lima | 37 | 14 |
| TechNova Software | 41 | 13 |
| Pet&Cia | 44 | 12 |
| Construtora Horizonte | 34 | 12 |
| Distribuidora Sol | 44 | 11 |

## 3. Ciclo de entrega e revisões

| Indicador | Valor |
| :--- | ---: |
| Entregas com data de solicitação e de entrega | 933 |
| Mediana do ciclo (dias) | 9 |
| P90 do ciclo (dias) | 21 |

| Tipo | Amostra | Mediana do ciclo (dias) |
| :--- | ---: | ---: |
| Relatório | 296 | 7 |
| Análise | 225 | 14 |
| Conteúdo | 412 | 11 |

Distribuição do número de revisões: {"0": 721, "1": 228, "2": 47, "3": 2}

| Faixa de revisões | Comparáveis | Atrasadas | Taxa de atraso |
| :--- | ---: | ---: | ---: |
| 0 revisões | 646 | 181 | 28,0% |
| 1 revisão | 194 | 77 | 39,7% |
| 2+ revisões | 39 | 15 | 38,5% |

## 4. Qualidade dos dados

| Problema | Ocorrências |
| :--- | ---: |
| IDs duplicados | 24 linhas (12 IDs distintos) |
| Possíveis duplicatas (cliente + título + datas) | 38 linhas |
| Links repetidos | 42 linhas (21 links distintos) |
| Sem link de arquivo | 59 |
| Link textual ("no e-mail", "ver drive", "pasta do cliente") | 20 |
| Status desconhecido | 0 |
| Tipo inferido (vazio ou inválido) | 4 |
| Concluída sem data de entrega | 15 |
| Entrega antes da solicitação | 2 |
| Entrega fora da janela (após out/2026) | 5 |
| Cancelada com arquivo publicado | 0 |
| Status "aprovado" sem aprovação registrada | 0 |
| Aprovação contraditória com o status | 4 |
| **Linhas em fila de revisão (algum problema crítico)** | **47** |

Ocorrências contam registros de problema; linhas contam entregas distintas.
São 302 ocorrências em 210 linhas;
121 ocorrências críticas em 47 linhas.

### Concluídas sem data de entrega (15 casos)

São entregas com status final (entregue/aprovada) e `data_entrega` em branco.
Sem a data, o atraso e o ciclo não são calculados — ficam fora dos
comparáveis. A decisão de produto (D14): o time preenche a data real na fila
de revisão do app, ou confirma "não sei". O diagnóstico **não infere** data
para esses casos: a sujeira fica visível de propósito.

| legacy_id | Cliente | Título | Prazo |
| :--- | :--- | :--- | :--- |
| 37 | Farmácia Bem Estar | Análise de backlinks | 2025-11-17 |
| 40 | Distribuidora Sol | Artigo: tendências de serviços | 2025-11-18 |
| 236 | Casa Bela Móveis | Artigo: erros comuns em preços | 2026-02-10 |
| 282 | Ótica Visão | Artigo: erros comuns em manutenção | 2026-02-17 |
| 396 | Moda Urbana | Auditoria técnica do site | 2026-04-10 |
| 465 | Editora Páginas | Auditoria técnica do site | 2026-05-04 |
| 536 | Distribuidora Sol | Pesquisa de palavras-chave | 2026-05-29 |
| 585 | Seguros Confia | Relatório mensal 06/2026 | 2026-06-10 |
| 644 | Loja Alfa | Artigo: guia completo de inovação | 2026-07-05 |
| 680 | TechNova Software | Artigo: comparativo de atendimento | 2026-07-11 |
| 696 | Farmácia Bem Estar | Artigo: guia completo de preços | 2026-07-22 |
| 712 | Casa Bela Móveis | Mapeamento de conteúdo | 2026-08-01 |
| 733 | AutoPeças Rodas | Artigo: comparativo de planos | 2026-08-07 |
| 812 | Hotel Mirante | Análise de backlinks | 2026-09-03 |
| 943 | Viagens Atlântico | Artigo: comparativo de produtos | 2026-10-20 |

### Entregas sem link de arquivo (59)

São entregas concluídas sem link do arquivo. Sem o link, o cliente não recebe
nada pelo portal e a aprovação perde sentido. A decisão de produto (D15): o
time preenche o link real na fila de revisão, ou confirma que não tem arquivo.
O diagnóstico **não inventa** link.

| legacy_id | Cliente | Título | Tipo |
| :--- | :--- | :--- | :--- |
| 26 | Café Montanha | Mapeamento de conteúdo | Análise |
| 44 | Farmácia Bem Estar | Pesquisa de palavras-chave | Análise |
| 61 | Editora Páginas | Artigo: checklist de serviços | Conteúdo |
| 67 | Farmácia Bem Estar | Artigo: perguntas frequentes sobre preços | Conteúdo |
| 113 | Editora Páginas | Artigo: como escolher manutenção | Conteúdo |
| 196 | Clínica Sorriso | Artigo: glossário de atendimento | Conteúdo |
| 309 | Loja Alfa | Artigo: comparativo de planos | Conteúdo |
| 310 | Clínica Sorriso | Artigo: glossário de produtos | Conteúdo |
| 435 | Café Montanha | Mapeamento de conteúdo | Análise |
| 622 | Café Montanha | Artigo: guia completo de planos | Conteúdo |
| 628 | Casa Bela Móveis | Artigo: checklist de planos | Conteúdo |
| 679 | Seguros Confia | Artigo: perguntas frequentes sobre inovação | Conteúdo |
| 682 | Cosméticos Bela | Artigo: guia completo de segurança | Conteúdo |
| 723 | TechNova Software | Artigo: tendências de produtos | Conteúdo |
| 728 | Café Montanha | Pesquisa de palavras-chave | Análise |
| 730 | TechNova Software | Artigo: guia completo de preços | Conteúdo |
| 735 | Logística Rápida | Artigo: erros comuns em serviços | Conteúdo |
| 775 | AutoPeças Rodas | Artigo: perguntas frequentes sobre atendimento | Conteúdo |
| 798 | Clínica Sorriso | Análise de backlinks | Análise |
| 813 | Moda Urbana | Artigo: tendências de planos | Conteúdo |
| 815 | Farmácia Bem Estar | Análise de concorrência | Análise |
| 816 | Advocacia Lima | Auditoria técnica do site | Análise |
| 820 | Casa Bela Móveis | Relatório mensal 09/2026 | Relatório |
| 826 | Farmácia Bem Estar | Relatório mensal 09/2026 | Relatório |
| 842 | Pet&Cia | Mapeamento de conteúdo | Análise |
| 846 | Hotel Mirante | Artigo: erros comuns em atendimento | Conteúdo |
| 883 | Café Montanha | Artigo: glossário de serviços | Conteúdo |
| 894 | Casa Bela Móveis | Artigo: guia completo de planos | Conteúdo |
| 901 | Loja Alfa | Relatório mensal 10/2026 | Relatório |
| 910 | Farmácia Bem Estar | Relatório mensal 10/2026 | Relatório |
| 913 | Moda Urbana | Relatório mensal 10/2026 | Relatório |
| 916 | Café Montanha | Relatório mensal 10/2026 | Relatório |
| 927 | Farmácia Bem Estar | Artigo: guia completo de preços | Conteúdo |
| 928 | Hotel Mirante | Artigo: perguntas frequentes sobre produtos | Conteúdo |
| 933 | Hotel Mirante | Artigo: guia completo de manutenção | Conteúdo |
| 937 | Hotel Mirante | Artigo: perguntas frequentes sobre segurança | Conteúdo |
| 938 | Café Montanha | Artigo: como escolher atendimento | Conteúdo |
| 942 | TechNova Software | Análise de Core Web Vitals | Análise |
| 945 | Imobiliária Lar | Artigo: comparativo de preços | Conteúdo |
| 946 | Seguros Confia | Artigo: comparativo de segurança | Conteúdo |
| 948 | Academia Força | Diagnóstico de indexação | Análise |
| 951 | Farmácia Bem Estar | Artigo: guia completo de atendimento | Conteúdo |
| 960 | Moda Urbana | Artigo: checklist de produtos | Conteúdo |
| 962 | Logística Rápida | Artigo: checklist de segurança | Conteúdo |
| 963 | Loja Alfa | Artigo: erros comuns em planos | Conteúdo |
| 965 | Grupo Vértice Saúde | Análise de concorrência | Análise |
| 967 | Escola Saber Mais | Artigo: glossário de inovação | Conteúdo |
| 969 | Pet&Cia | Diagnóstico de indexação | Análise |
| 971 | Grupo Vértice Saúde | Artigo: como escolher produtos | Conteúdo |
| 972 | Grupo Vértice Saúde | Auditoria técnica do site | Análise |
| 974 | Pet&Cia | Mapeamento de conteúdo | Análise |
| 975 | Editora Páginas | Mapeamento de conteúdo | Análise |
| 976 | Clínica Sorriso | Artigo: erros comuns em planos | Conteúdo |
| 977 | Moda Urbana | Artigo: comparativo de planos | Conteúdo |
| 979 | Agro Verde | Pesquisa de palavras-chave | Análise |
| 981 | Distribuidora Sol | Artigo: guia completo de planos | Conteúdo |
| 983 | Ótica Visão | Diagnóstico de indexação | Análise |
| 984 | Imobiliária Lar | Artigo: tendências de preços | Conteúdo |
| 985 | Pet&Cia | Artigo: guia completo de planos | Conteúdo |

### Todos os códigos de qualidade encontrados

| Código | Linhas |
| :--- | ---: |
| `aprovacao_sem_status_final` | 134 |
| `sem_link` | 59 |
| `link_repetido` | 42 |
| `possivel_duplicata` | 38 |
| `cliente_grafia_variante` | 29 |
| `id_duplicado` | 24 |
| `link_textual` | 20 |
| `data_prevista_texto_ano_inferido` | 17 |
| `data_entrega_texto_ano_inferido` | 16 |
| `concluida_sem_data_entrega` | 15 |
| `data_entrega_serial_excel` | 14 |
| `data_prevista_serial_excel` | 13 |
| `data_solicitacao_serial_excel` | 10 |
| `data_solicitacao_texto_ano_inferido` | 8 |
| `entrega_fora_janela` | 5 |
| `tipo_inferido` | 4 |
| `revisoes_outlier` | 3 |
| `revisoes_negativo` | 3 |
| `revisoes_vazio` | 2 |
| `revisoes_texto_convertido` | 2 |
| `entrega_antes_solicitacao` | 2 |
| `revisoes_texto_nao_numerico` | 1 |

## 5. Status: como a planilha fala e como o app passa a falar

A coluna `status` mistura fase de produção, espera e aprovação. O mapeamento abaixo
separa as duas dimensões (fase + aprovação). A lista completa está em `mapa_status.csv`.

| Status original | Fase normalizada | Linhas |
| :--- | :--- | ---: |
| Aprovado | `aprovada` | 532 |
| Entregue | `entregue` | 61 |
| entregue | `entregue` | 60 |
| aprovado | `aprovada` | 58 |
| APROVADO | `aprovada` | 58 |
| aprovado pelo cliente | `aprovada` | 57 |
| ok | `aprovada` | 49 |
| finalizado | `aprovada` | 45 |
| Em produção | `em_producao` | 32 |
| Cancelado | `cancelada` | 8 |
| Entrega em aprovação | `aguardando_aprovacao_entrega` | 8 |
| Em andamento | `em_producao` | 7 |
| em produçao | `em_producao` | 6 |
| fazendo | `em_producao` | 6 |
| cancelado | `cancelada` | 4 |
| em produção | `em_producao` | 4 |
| Ajuste solicitado | `ajuste_solicitado` | 4 |
| Aguardando cliente | `aguardando_cliente` | 3 |
| aguardando aprovação | `aguardando_aprovacao_entrega` | 2 |
| voltou pra ajuste | `ajuste_solicitado` | 1 |
| com o cliente | `aguardando_aprovacao_entrega` | 1 |
| enviado | `entregue` | 1 |

Aprovação de planejamento após normalização:
{
  "nao_aplica": 293,
  "aprovada": 676,
  "aprovada_com_ressalvas": 20,
  "nao_informado": 13,
  "recusada": 5
}

Aprovação de entrega após normalização:
{
  "aprovada": 901,
  "aprovada_com_ressalvas": 32,
  "nao_informado": 69,
  "recusada": 5
}

## 6. Tipos e subtipos

- Tipos normalizados: {"Relatório": 303, "Análise": 248, "Conteúdo": 456}
- Subtipos de Análise: {"Mapeamento de conteúdo": 29, "Palavras-chave": 45, "Core Web Vitals": 37, "Backlinks": 43, "Análise não especificada": 30, "Concorrência": 29, "Indexação": 27, "Auditoria técnica do site": 8}

## 7. Observações livres

8 categorias identificadas; as demais linhas não têm observação.

| Categoria | Linhas |
| :--- | ---: |
| outra | 24 |
| revisão/refação | 31 |
| revisão jurídica do cliente | 5 |
| prazo renegociado | 27 |
| cancelamento/suspensão | 10 |
| regra contratual de prazo | 14 |
| pedido de redistribuição | 6 |
| pessoa saiu da empresa | 7 |

## 8. Conclusões para o produto

1. **Atraso não é medível hoje**: 30,7% das entregas comparáveis
   passaram do prazo. O app precisa calcular atraso a partir de `data_prevista` e
   `data_entrega`, e tratar "em aberto com prazo vencido" como estado próprio.
2. **Status não responde "onde está a entrega"**: são 22 valores
   distintos de status para 7 fases reais.
   A separação entre fase e aprovação é o que permite rastrear o processo.
3. **A base tem duplicidade real**: 12 IDs repetidos
   (24 linhas) e 38 linhas com assinatura
   idêntica. Nada pode ser apagado sem revisão; a importação precisa de uma fila de revisão.
4. **Cliente não é uma dimensão confiável sem normalização**: 31
   grafias para 25 clientes.
5. **O cliente não tem visibilidade**: não existe status voltado ao cliente nem registro
   de aprovação com autor e data. O fluxo de aprovação por link resolve isso.
6. **Concluídas sem data de entrega** (15 casos):
   status final sem `data_entrega`. A decisão (D14) é o time preencher a data
   real na fila de revisão do app — o diagnóstico não infere, a sujeira fica
   visível.
