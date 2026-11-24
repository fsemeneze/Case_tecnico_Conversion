# Diagnóstico dos dados — controle de entregas

Gerado automaticamente por `analysis/diagnostico.py` em 2026-11-23T21:27:56.
Arquivo de origem: `dados\controle_entregas.csv`.
Data de referência para "em atraso hoje": **2026-11-23**.

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
| Entrega fora da janela (após out/2026) | 0 |
| Cancelada com arquivo publicado | 0 |
| Status "aprovado" sem aprovação registrada | 0 |
| Aprovação contraditória com o status | 4 |
| **Linhas em fila de revisão (algum problema crítico)** | **47** |

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
