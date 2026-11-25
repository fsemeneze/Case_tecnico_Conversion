import Link from "next/link";
import Seguranca from "./seguranca";

export default function PaginaSeguranca() {
  return (
    <>
      <header className="topo">
        <div>
          <p className="eyebrow">PlanOps</p>
          <h1>Segurança da conta</h1>
        </div>
        <Link href="/inicio" className="botao secundario">
          ← Voltar
        </Link>
      </header>

      <p className="muted">
        A senha é gerenciada pelo Supabase Auth. Aqui você controla a
        verificação em duas etapas.
      </p>

      <Seguranca />

      <div className="cartao" style={{ marginTop: 16, maxWidth: 560 }}>
        <h2>Senha</h2>
        <p className="muted">
          Para trocar a senha, use “Esqueci minha senha” na tela de login. O
          link chega no seu e-mail e vale 1 hora.
        </p>
      </div>
    </>
  );
}