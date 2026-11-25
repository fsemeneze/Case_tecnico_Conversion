"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

// Etapa 2 da recuperação: o link do e-mail traz a sessão; aqui só troca a senha.
export default function NovaSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (senha.length < 8) {
      setErro("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não conferem.");
      return;
    }

    setAguardando(true);
    const supabase = criarClienteSupabaseNavegador();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setAguardando(false);

    if (error) {
      setErro(
        error.message.includes("expired")
          ? "Este link expirou. Peça um novo em “Esqueci minha senha”."
          : `Não foi possível salvar: ${error.message}`,
      );
      return;
    }

    router.push("/inicio");
    router.refresh();
  }

  return (
    <div className="auth-cartao">
      <h2>Nova senha</h2>
      <p className="auth-ajuda">
        Escolha uma senha com pelo menos 8 caracteres. Ela vale para todas as
        suas sessões.
      </p>

      <form onSubmit={salvar} className="auth-form">
        <label>
          Nova senha
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </label>
        <label>
          Repita a senha
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </label>

        {erro && (
          <p className="erro" role="alert">
            {erro}
          </p>
        )}

        <button type="submit" disabled={aguardando}>
          {aguardando ? "Salvando…" : "Salvar senha"}
        </button>
      </form>

      <p className="auth-rodape-link">
        <Link href="/login">← Voltar ao login</Link>
      </p>
    </div>
  );
}