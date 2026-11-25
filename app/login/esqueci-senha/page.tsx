"use client";

import { useState } from "react";
import Link from "next/link";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

// Etapa 1 da recuperação: informa o e-mail e recebe o link.
export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login/nova-senha`,
    });
    setAguardando(false);

    // Mensagem genérica de propósito: não revela se o e-mail existe.
    if (error) {
      setErro("Não foi possível enviar agora. Tente novamente em instantes.");
      return;
    }
    setEnviado(true);
  }

  return (
    <main className="login">
      <div className="login-caixa">
        <p className="marca">PlanOps</p>
        <h1>Esqueci minha senha</h1>

        {enviado ? (
          <>
            <p className="muted">
              Se este e-mail estiver cadastrado, o link de recuperação foi
              enviado. Ele vale por 1 hora.
            </p>
            <p className="muted">
              Não chegou? Confira o spam ou peça um novo link ao administrador.
            </p>
            <Link href="/login" className="botao secundario">
              ← Voltar ao login
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              Informe o e-mail cadastrado. Você recebe um link para definir uma
              senha nova.
            </p>
            <form onSubmit={enviar} className="cartao-form">
              <label>
                E-mail
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@conversion.com.br"
                />
              </label>
              {erro && <p className="erro">{erro}</p>}
              <button type="submit" disabled={aguardando}>
                {aguardando ? "Enviando…" : "Enviar link"}
              </button>
            </form>
            <p className="muted login-rodape">
              <Link href="/login">← Voltar ao login</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}