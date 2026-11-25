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
            PlanOps
          </Link>

          <h1>
            Planejamento e entregas,
            <br />
            sem planilha.
          </h1>

          <p className="auth-sub">
            Da solicitação à aprovação do cliente, com histórico de quem decidiu
            o quê e quando.
          </p>

          <ul className="auth-itens">
            <li>
              <span className="auth-check" aria-hidden="true" />
              Aprovação do cliente em duas etapas, por link
            </li>
            <li>
              <span className="auth-check" aria-hidden="true" />
              Atraso com definição única, do diagnóstico ao app
            </li>
            <li>
              <span className="auth-check" aria-hidden="true" />
              Histórico e fila de revisão, sem perder nada
            </li>
          </ul>
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