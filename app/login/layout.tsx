import Link from "next/link";
import { TemaToggle } from "@/app/tema-toggle";

// Casca das telas de autenticação (/login e as duas de recuperação).
// Duas colunas no desktop: marca + proposta à esquerda, card à direita.
export default function LayoutLogin({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="auth">
      <div className="auth-grade">
        <section className="auth-marca">
          <Link href="/login" className="auth-logo">
            <span className="auth-logo-mark" aria-hidden="true" />
            PlanHub
          </Link>

          <h1>Planejamento e entregas</h1>
        </section>

        <section className="auth-painel">
          <div className="auth-tema">
            <TemaToggle compacto />
          </div>
          {children}
          <p className="auth-rodape">
            Acesso por convite. O cliente aprova pelo link que o time envia.
          </p>
        </section>
      </div>
    </main>
  );
}