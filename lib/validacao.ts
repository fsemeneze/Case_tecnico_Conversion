import { z } from "zod";

// Validação compartilhada entre servidor (Server Action) e cliente (formulário).
// Campos de texto com trim; datas aceitam ISO (yyyy-mm-dd) ou vazia.

const texto = (rotulo: string, maximo = 200) =>
  z.string().trim().max(maximo, `${rotulo}: no máximo ${maximo} caracteres`).optional().default("");

const data = z
  .string()
  .trim()
  .optional()
  .default("")
  .refine(
    (valor) => valor === "" || /^\d{4}-\d{2}-\d{2}$/.test(valor),
    "Data inválida (use yyyy-mm-dd).",
  );

export const schemaEntrega = z.object({
  titulo: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(200),
  cliente_id: z.string().optional().default(""),
  novo_cliente: z.string().trim().max(200).optional().default(""),
  tipo: z.enum(["Relatório", "Análise", "Conteúdo"]),
  subtipo: texto("Subtipo", 80),
  squad: texto("Squad", 80),
  responsavel: texto("Responsável", 80),
  data_solicitacao: data,
  data_prevista: data,
  link: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (valor) =>
        valor === "" ||
        valor.startsWith("https://") ||
        valor.startsWith("http://"),
      "O link deve começar com http:// ou https://.",
    ),
  observacoes: z.string().trim().max(1000, "Observações: no máximo 1000 caracteres.").optional().default(""),
});

export type EntradaEntrega = z.infer<typeof schemaEntrega>;

// Edição de entrega existente: mesmos campos do cadastro, sem tipo (não muda)
// e com número de revisões.
export const schemaEdicaoEntrega = z.object({
  titulo: z.string().trim().min(3, "Informe um título com pelo menos 3 caracteres.").max(200),
  data_prevista: data,
  data_entrega: data,
  num_revisoes: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, "Número de revisões inválido.")
    .optional()
    .default(""),
  link: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine(
      (valor) =>
        valor === "" ||
        valor.startsWith("https://") ||
        valor.startsWith("http://"),
      "O link deve começar com http:// ou https://.",
    ),
  observacoes: z.string().trim().max(1000, "Observações: no máximo 1000 caracteres.").optional().default(""),
  squad: texto("Squad", 80),
  responsavel: texto("Responsável", 80),
});

export type EntradaEdicao = z.infer<typeof schemaEdicaoEntrega>;

// Primeiro erro legível de um resultado de validação.
export function primeiroErro(resultado: z.ZodSafeParseResult<unknown>): string | null {
  if (resultado.success) return null;
  return resultado.error.issues[0]?.message ?? "Dados inválidos.";
}