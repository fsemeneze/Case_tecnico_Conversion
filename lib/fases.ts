// Rótulos e regras de apresentação das fases/aprovações (D2, D8).
export const ROTULO_FASE: Record<string, string> = {
  solicitada: "Solicitada",
  em_producao: "Em produção",
  aguardando_cliente: "Aguardando o cliente",
  aguardando_aprovacao_entrega: "Aguardando aprovação da entrega",
  ajuste_solicitado: "Ajuste solicitado",
  entregue: "Entregue",
  aprovada: "Aprovada",
  cancelada: "Cancelada",
};

export const FASES_ABERTAS = [
  "solicitada",
  "em_producao",
  "aguardando_cliente",
  "aguardando_aprovacao_entrega",
  "ajuste_solicitado",
] as const;

export const ROTULO_APROVACAO: Record<string, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  aprovada_com_ressalvas: "Aprovada com ressalvas",
  recusada: "Recusada",
  nao_aplica: "Não se aplica",
  nao_informado: "Não informado",
};

// Situação de uma entrega na definição única de atraso (D8):
// - concluída: data_entrega > data_prevista → "após o prazo";
// - em aberto: data_prevista < hoje → "vencida";
export function situacaoDaEntrega(
  entrega: { fase: string; data_prevista: string | null; dias_atraso: number | null },
  hoje: string,
): { rotulo: string; tom: "ok" | "alerta" | "erro" | "neutro" } {
  if (entrega.fase === "cancelada") return { rotulo: "Cancelada", tom: "neutro" };
  if (entrega.fase === "aprovada" || entrega.fase === "entregue") {
    if ((entrega.dias_atraso ?? 0) > 0) {
      return { rotulo: `Entregue após o prazo (${entrega.dias_atraso} dias)`, tom: "erro" };
    }
    return { rotulo: "No prazo", tom: "ok" };
  }
  if (entrega.data_prevista && entrega.data_prevista < hoje) {
    const dias = Math.floor(
      (Date.parse(hoje) - Date.parse(entrega.data_prevista)) / 86_400_000,
    );
    return { rotulo: `Vencida há ${dias} dias`, tom: "alerta" };
  }
  return { rotulo: "No prazo", tom: "ok" };
}
