"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

type Estado = { erro?: string };

// Porta de entrada do PlanOps: login por convite, sem cadastro público.
export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [aguardando, setAguardando] = useState(false);
  const [estado, setEstado] = useState<Estado>({});

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado({});
    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    setAguardando(false);
    if (error) {
      setEstado({
        erro:
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : `Não foi possível entrar: ${error.message}`,
      });
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
        </form>

        <p className="muted login-rodape">
          Acesso por convite. Não tem conta? Peça ao administrador.
        </p>
      </div>
    </main>
  );
}