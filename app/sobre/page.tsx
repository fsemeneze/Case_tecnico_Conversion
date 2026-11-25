import Link from "next/link";

// Página institucional do produto: o que é, como funciona e o que vem depois.
export default function Sobre() {
  return (
    <main className="sobre">
      <h1>Planejamento e entregas</h1>
      <p className="lead">
        Toda a operação de entregas em um só lugar: lista com filtros e busca,
        cadastro de entregas e aprovação do cliente em duas etapas, com
        histórico de quem decidiu o quê e quando.
      </p>

      <h2>Como funciona</h2>
      <ul>
        <li>
          O time cadastra cada entrega e acompanha a fase, da solicitação à
          aprovação.
        </li>
        <li>
          O cliente aprova o planejamento e a entrega por link, sem login, com
          nome e data registrados.
        </li>
        <li>
          Cada entrega guarda o histórico de fases, aprovações e revisões, com
          autor e data.
        </li>
        <li>
          Atraso com uma definição única: concluída após o prazo ou em aberto
          com prazo vencido.
        </li>
        <li>
          Acesso por convite, com quatro papéis: admin, gestor, operador e
          leitor.
        </li>
      </ul>

      <h2>Para o cliente</h2>
      <ul>
        <li>
          Aprovação por link, sem conta: o link chega por e-mail e o cliente
          decide com nome e observação.
        </li>
        <li>
          Portal de acompanhamento, somente leitura, com todas as entregas do
          cliente: fase atual, prazo e conteúdo.
        </li>
      </ul>

      <h2>Notificações por e-mail</h2>
      <p className="muted">
        O cliente recebe o link de aprovação por e-mail e o time é avisado
        quando o cliente decide. O dashboard tem um acionador para avisar
        clientes com prazo vencido.
      </p>

      <h2>O que vem depois</h2>
      <ul>
        <li>Notificação por WhatsApp, além do e-mail.</li>
        <li>Exportação CSV e gráficos além dos indicadores de atraso.</li>
        <li>Integração com o calendário.</li>
      </ul>

      <h2>Uso de IA</h2>
      <p className="muted">
        Código, migrations e testes foram escritos com apoio de agente de código
        (OpenCode) e revisados manualmente.
      </p>

      <div className="links">
        <Link href="/login">Entrar no app</Link>
      </div>

      <footer>
        Stack: Supabase (Postgres, Auth, RLS), Next.js e Vercel.
      </footer>
    </main>
  );
}
