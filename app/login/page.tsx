"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

type Estado = { erro?: string };

// Porta de entrada do PlanOps: login por convite, sem cadastro público.
// Se a conta tiver MFA, pede o código do autenticador antes de entrar.
export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [fatorId, setFatorId] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);
  const [estado, setEstado] = useState<Estado>({});

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado({});
    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setAguardando(false);
      setEstado({
        erro:
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message === "Email logins are disabled"
              ? "O login por e-mail está desativado no momento. Fale com o administrador."
              : `Não foi possível entrar: ${error.message}`,
      });
      return;
    }

    // Conta com fator de segunda etapa: pede o código.
    const fatores = data.user?.factors ?? [];
    if (fatores.length > 0) {
      setFatorId(fatores[0].id);
      setAguardando(false);
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (!fatorId) return;
    setEstado({});
    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();

    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
      factorId: fatorId,
    });
    if (erroDesafio || !desafio) {
      setAguardando(false);
      setEstado({ erro: "Não foi possível validar o código. Tente novamente." });
      return;
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: fatorId,
      challengeId: desafio.id,
      code: codigo.trim(),
    });
    setAguardando(false);

    if (error) {
      setEstado({ erro: "Código incorreto ou expirado." });
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <main className="login">
      <div className="login-caixa">
        <p className="marca">PlanOps</p>
        <h1>Planejamento e entregas</h1>
        <p className="muted">
          Acesso do time. O cliente aprova pelo link que o time envia — aqui não.
        </p>

        {fatorId === null ? (
          <form onSubmit={entrar} className="cartao-form">
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
            <label>
              Senha
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="sua senha"
              />
            </label>

            {estado.erro && <p className="erro">{estado.erro}</p>}

            <button type="submit" disabled={aguardando}>
              {aguardando ? "Entrando…" : "Entrar"}
            </button>

            <p className="muted login-rodape">
              <Link href="/login/esqueci-senha">Esqueci minha senha</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={confirmarCodigo} className="cartao-form">
            <h2>Código do autenticador</h2>
            <p className="muted">
              Sua conta tem verificação em duas etapas. Digite o código de 6
              dígitos do aplicativo.
            </p>
            <label>
              Código
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
            </label>

            {estado.erro && <p className="erro">{estado.erro}</p>}

            <div className="botoes">
              <button type="submit" disabled={aguardando || codigo.length !== 6}>
                {aguardando ? "Validando…" : "Confirmar"}
              </button>
              <button
                type="button"
                className="secundario"
                disabled={aguardando}
                onClick={() => {
                  setFatorId(null);
                  setCodigo("");
                  setEstado({});
                }}
              >
                Voltar
              </button>
            </div>
          </form>
        )}

        <p className="muted login-rodape">
          Acesso por convite. Não tem conta? Peça ao administrador.
        </p>
      </div>
    </main>
  );
}