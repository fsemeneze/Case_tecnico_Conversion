import { criarClienteSupabaseAdmin } from "./supabase/admin";

// Envio de e-mail via Resend (API REST). Só roda no servidor.
// Configuração por variáveis de ambiente:
//   RESEND_API_KEY  — chave do Resend (obrigatória)
//   EMAIL_FROM      — remetente (ex.: "PlanHub <onboarding@resend.dev>")
//   EMAIL_EQUIPE    — destinatário interno para avisos (ex.: ops@planops.case)

export type ResultadoEmail = {
  ok: boolean;
  erro?: string;
  id?: string;
  // Quando o provedor está sem domínio verificado (modo de teste), ele só
  // entrega ao e-mail da própria conta e recusa os demais. Guardamos isso para
  // explicar a limitação na tela, em vez de deixar o usuário achar que enviou.
  modoTeste?: boolean;
  enderecoPermitido?: string;
};

const MODO_TESTE = /only send testing emails|testing emails/i;

export function limitacaoDoProvedor(erro?: string): {
  modoTeste: boolean;
  enderecoPermitido?: string;
} {
  if (!erro || !MODO_TESTE.test(erro)) return { modoTeste: false };
  // A mensagem do Resend traz o endereço liberado entre parênteses:
  // "You can only send testing emails to your own email address (voce@exemplo.com)."
  const achado = erro.match(/\(([^)\s]+@[^)\s]+)\)/);
  return { modoTeste: true, enderecoPermitido: achado?.[1] };
}

type OpcoesEmail = {
  para: string;
  assunto: string;
  html: string;
  texto?: string;
  tipo: string;
  entidadeId?: number | null;
};

async function registrar(
  tipo: string,
  destino: string,
  assunto: string,
  status: "enviado" | "erro",
  erro: string | null,
  entidadeId?: number | null,
) {
  try {
    const admin = criarClienteSupabaseAdmin();
    await admin.from("notificacoes").insert({
      tipo,
      destino,
      assunto,
      status,
      erro,
      entidade_id: entidadeId ?? null,
    });
  } catch {
    // Se o log falhar, o envio em si não deve ser afetado.
  }
}

export async function enviarEmail(opcoes: OpcoesEmail): Promise<ResultadoEmail> {
  const chave = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "PlanHub <onboarding@resend.dev>";

  if (!chave) {
    const erro = "RESEND_API_KEY não configurada.";
    await registrar(opcoes.tipo, opcoes.para, opcoes.assunto, "erro", erro, opcoes.entidadeId);
    return { ok: false, erro };
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opcoes.para],
        subject: opcoes.assunto,
        html: opcoes.html,
        text: opcoes.texto,
      }),
    });
    const data = (await resp.json()) as { id?: string; message?: string };
    if (!resp.ok) {
      const erro = data?.message ?? `HTTP ${resp.status}`;
      await registrar(opcoes.tipo, opcoes.para, opcoes.assunto, "erro", erro, opcoes.entidadeId);
      return { ok: false, erro, ...limitacaoDoProvedor(erro) };
    }
    await registrar(opcoes.tipo, opcoes.para, opcoes.assunto, "enviado", null, opcoes.entidadeId);
    return { ok: true, id: data?.id };
  } catch (e) {
    const erro = e instanceof Error ? e.message : "Erro inesperado no envio.";
    await registrar(opcoes.tipo, opcoes.para, opcoes.assunto, "erro", erro, opcoes.entidadeId);
    return { ok: false, erro };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const envelope = (titulo: string, corpo: string) => `
<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#1649ff;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;font-weight:700">PlanHub</div>
  <div style="border:1px solid #e2e8f0;border-top:none;padding:22px;border-radius:0 0 12px 12px">
    <h2 style="margin:0 0 12px;font-size:18px">${titulo}</h2>
    ${corpo}
    <p style="color:#64748b;font-size:12px;margin-top:18px">Enviado automaticamente pelo PlanHub.</p>
  </div>
</div>`;

export function emailLinkAprovacao(d: {
  cliente: string;
  titulo: string;
  etapa: string;
  prazo: string | null;
  url: string;
  validadeDias: number;
}) {
  const etapaRotulo = d.etapa === "planejamento" ? "planejamento" : "entrega";
  const corpo = `
    <p>Olá, ${d.cliente}.</p>
    <p>O <strong>${d.titulo}</strong> está pronto para sua aprovação de <strong>${etapaRotulo}</strong>.</p>
    ${d.prazo ? `<p>Prazo: <strong>${d.prazo}</strong></p>` : ""}
    <p style="margin:18px 0">
      <a href="${d.url}" style="background:#1649ff;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:600">Aprovar / ver entrega</a>
    </p>
    <p style="color:#64748b;font-size:13px">O link é de uso único e vale ${d.validadeDias} dias.</p>`;
  return {
    assunto: `Aprovação de ${etapaRotulo} — ${d.titulo}`,
    html: envelope(`Aprovação de ${etapaRotulo}`, corpo),
    texto: `Aprovação de ${etapaRotulo} — ${d.titulo}\nPrazo: ${d.prazo ?? "—"}\nLink: ${d.url}\nVálido por ${d.validadeDias} dias.`,
  };
}

export function emailDecisaoCliente(d: {
  titulo: string;
  cliente: string;
  etapa: string;
  decisao: string;
  autor: string;
  observacao: string | null;
}) {
  const corpo = `
    <p>O cliente <strong>${d.cliente}</strong> registrou uma decisão sobre <strong>${d.titulo}</strong>.</p>
    <ul>
      <li>Etapa: <strong>${d.etapa}</strong></li>
      <li>Decisão: <strong>${d.decisao}</strong></li>
      <li>Autor: <strong>${d.autor}</strong></li>
      ${d.observacao ? `<li>Observação: “${d.observacao}”</li>` : ""}
    </ul>`;
  return {
    assunto: `Cliente ${d.decisao}: ${d.titulo}`,
    html: envelope("Decisão do cliente", corpo),
    texto: `Cliente ${d.cliente} — ${d.decisao} — ${d.titulo} (etapa ${d.etapa}, autor ${d.autor}).`,
  };
}

export function emailPrazoVencido(d: {
  cliente: string;
  entregas: { titulo: string; prazo: string; dias: number }[];
}) {
  const itens = d.entregas
    .map((e) => `<li><strong>${e.titulo}</strong> — prazo ${e.prazo} (vencido há ${e.dias} dia(s))</li>`)
    .join("");
  const corpo = `
    <p>Olá, ${d.cliente}.</p>
    <p>Estas entregas estão em aberto e com prazo vencido:</p>
    <ul>${itens}</ul>
    <p>Podemos ajudar a repriorizar? Responda este e-mail para alinharmos o prazo.</p>`;
  return {
    assunto: `Entregas com prazo vencido — ${d.cliente}`,
    html: envelope("Prazo vencido", corpo),
    texto: `Entregas vencidas de ${d.cliente}:\n${d.entregas.map((e) => `- ${e.titulo} (prazo ${e.prazo})`).join("\n")}`,
  };
}