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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/conversion-mark.svg" alt="" width={26} height={26} className="auth-logo-mark" />
            PlanHub
          </Link>

          <h1>Planejamento e entregas</h1>
          <p className="auth-sub">
            O app de entregas da Conversion. Planeje, acompanhe e tenha as
            aprovações do cliente registradas em um só lugar.
          </p>

          <ul className="auth-itens">
            <li>
              <span className="auth-check" aria-hidden="true" />
              Planejamento e fase de cada entrega
            </li>
            <li>
              <span className="auth-check" aria-hidden="true" />
              Aprovação do cliente por link, com nome e data
            </li>
            <li>
              <span className="auth-check" aria-hidden="true" />
              Acesso por convite, com quatro papéis de usuário
            </li>
            <li>
              <span className="auth-check" aria-hidden="true" />
              Histórico de quem decidiu o quê e quando
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