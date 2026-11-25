"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

type Estado = { erro?: string; aviso?: string };

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
    router.push("/entregas");
    router.refresh();
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setEstado({});
    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    setAguardando(false);
    if (error) {
      setEstado({ erro: `Não foi possível criar a conta: ${error.message}` });
      return;
    }
    if (data.session) {
      router.push("/entregas");
      router.refresh();
      return;
    }
    setEstado({
      aviso:
        "Conta criada. Se o e-mail de confirmação estiver habilitado no projeto, confirme no link enviado antes de entrar.",
    });
  }

  return (
    <main className="login">
      <form onSubmit={entrar} className="cartao-form">
        <p className="eyebrow">PlanOps</p>
        <h1>Planejamento e entregas</h1>
        <p className="muted">
          Acesso do time. O cliente aprova pelo link que o time envia — aqui não.
        </p>

        <label>
          E-mail
          <input
            type="email"
            required
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
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="mínimo de 6 caracteres"
          />
        </label>

        {estado.erro && <p className="erro">{estado.erro}</p>}
        {estado.aviso && <p className="aviso">{estado.aviso}</p>}

        <div className="botoes">
          <button type="submit" disabled={aguardando}>
            {aguardando ? "Aguardando…" : "Entrar"}
          </button>
          <button
            type="button"
            className="secundario"
            disabled={aguardando}
            onClick={criarConta}
          >
            Criar conta
          </button>
        </div>
      </form>
    </main>
  );
}
