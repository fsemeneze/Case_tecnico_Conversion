// Rótulos legíveis para o histórico de eventos. O banco guarda códigos
// ("importacao", "fase"); a UI nunca mostra o código cru.

export const ROTULO_EVENTO: Record<string, string> = {
  importacao: "Importação",
  fase: "Mudança de fase",
  criacao: "Entrega criada",
  atualizacao: "Atualização",
};

export const ROTULO_CAMPO: Record<string, string> = {
  fase: "Fase",
  data_prevista: "Data prevista",
  data_entrega: "Data de entrega",
  titulo: "Título",
  responsavel: "Responsável",
  link: "Link do conteúdo",
};

export function rotuloEvento(tipo: string): string {
  return ROTULO_EVENTO[tipo] ?? tipo;
}

export function rotuloCampo(campo: string | null): string | null {
  if (!campo) return null;
  return ROTULO_CAMPO[campo] ?? campo;
}

// Sinalizações de qualidade da carga de dados (códigos -> rótulos legíveis).
export const ROTULO_CODIGO: Record<string, string> = {
  id_duplicado: "ID repetido no arquivo original",
  possivel_duplicata: "Possível duplicata",
  link_repetido: "Link repetido",
  sem_link: "Sem link de arquivo",
  link_textual: "Link textual (não é URL)",
  data_prevista_texto_ano_inferido: "Ano inferido na data prevista",
  data_entrega_texto_ano_inferido: "Ano inferido na data de entrega",
  data_solicitacao_texto_ano_inferido: "Ano inferido na solicitação",
  data_prevista_serial_excel: "Data em serial do Excel",
  data_entrega_serial_excel: "Data em serial do Excel",
  data_solicitacao_serial_excel: "Data em serial do Excel",
  concluida_sem_data_entrega: "Concluída sem data de entrega",
  aprovacao_sem_status_final: "Aprovação sem status final",
  cliente_grafia_variante: "Grafia variante do cliente",
  revisoes_outlier: "Número de revisões implausível",
  revisoes_negativo: "Revisões negativas",
  revisoes_texto_nao_numerico: "Revisões em texto",
  revisoes_vazio: "Revisões em branco",
  revisoes_texto_convertido: "Revisões convertidas de texto",
  tipo_inferido: "Tipo inferido pelo título",
  entrega_antes_solicitacao: "Entrega antes da solicitação",
};

export function rotuloCodigo(codigo: string): string {
  return ROTULO_CODIGO[codigo] ?? codigo;
}
