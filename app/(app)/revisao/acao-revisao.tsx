"use client";

import type { ReactNode } from "react";

// Ação compacta da fila de revisão: um botão que abre o formulário inline.
// Mantém a tabela baixa; o formulário só aparece quando o time clica.
export function AcaoRevisao({
  rotulo,
  children,
}: {
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <details className="acao-revisao">
      <summary className="botao secundario">{rotulo}</summary>
      <div className="acao-revisao-form">{children}</div>
    </details>
  );
}