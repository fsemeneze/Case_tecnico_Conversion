"use server";

import { redirect } from "next/navigation";
import { criarClienteSupabaseAdmin } from "@/lib/supabase/admin";

// O cliente, já identificado pelo token do portal, abre a aprovação de uma
// entrega pendente sem depender do time gerar e reenviar um link. A função no
// banco só emite o token quando a entrega está de fato na fase que aguarda
// aquela etapa.
export async function abrirAprovacaoPeloPortal(formulario: FormData) {
  const portalToken = String(formulario.get("portal_token") ?? "");
  const entregaId = Number(formulario.get("entrega_id"));
  const etapa = String(formulario.get("etapa") ?? "");
  const destino = `/cliente/${portalToken}`;

  if (
    !portalToken ||
    !Number.isInteger(entregaId) ||
    !["planejamento", "entrega"].includes(etapa)
  ) {
    redirect(
      `${destino}?erro=${encodeURIComponent("Não foi possível abrir a aprovação.")}`,
    );
  }

  const admin = criarClienteSupabaseAdmin();
  const { data, error } = await admin.rpc("criar_token_aprovacao_portal", {
    p_portal_token: portalToken,
    p_entrega_id: entregaId,
    p_etapa: etapa,
    p_validade_horas: 168,
  });

  if (error || !data) {
    redirect(
      `${destino}?erro=${encodeURIComponent(
        error?.message ?? "Não foi possível abrir a aprovação.",
      )}`,
    );
  }

  redirect(`/aprovacao/${data}`);
}
