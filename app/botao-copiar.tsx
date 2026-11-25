"use client";

import { useState } from "react";
import { Icone } from "@/app/icones";

// Copia o link para a área de transferência. Existe porque o envio por e-mail
// pode não acontecer (cliente sem e-mail ou provedor sem domínio verificado):
// nesse caso o caminho manual é copiar e mandar pelo canal de contato.
export function BotaoCopiar({
  texto,
  rotulo = "Copiar link",
}: {
  texto: string;
  rotulo?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      // Navegador sem permissão de área de transferência: seleciona o texto.
      try {
        const campo = document.createElement("textarea");
        campo.value = texto;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        ok = document.execCommand("copy");
        document.body.removeChild(campo);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <button type="button" className="botao secundario" onClick={copiar} aria-live="polite">
      <Icone nome={copiado ? "check" : "copiar"} width={16} height={16} />
      {copiado ? "Copiado" : rotulo}
    </button>
  );
}
