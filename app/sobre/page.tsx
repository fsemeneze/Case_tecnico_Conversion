import Link from "next/link";

// README de produto (1 página), servido pelo próprio app.
// O texto canônico vive em docs/readme_produto.md.
export default function Sobre() {
  return (
    <main className="sobre">
      <p className="eyebrow">PlanOps</p>
      <h1>Planejamento e entregas</h1>
      <p className="lead">
        O controle de entregas da Conversion saiu da planilha e virou um app:
        lista com filtros e busca, cadastro de entregas e aprovação do cliente em
        duas etapas, com histórico de quem decidiu o quê e quando.
      </p>

      <h2>O que migrou igual</h2>
      <ul>
        <li>As 1.007 entregas da planilha, com as datas originais e a linha da planilha preservada.</li>
        <li>Os 25 clientes canônicos, com as 31 grafias originais guardadas como alias.</li>
        <li>A fila de revisão: 372 problemas na importação, 193 críticos.</li>
      </ul>

      <h2>O que mudou</h2>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Antes (planilha)</th>
              <th>Agora (PlanOps)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>22 valores de status misturando produção, espera e aprovação</td>
              <td>Fase (andamento) separada de aprovação (decisão do cliente)</td>
            </tr>
            <tr>
              <td>Atraso não era medível</td>
              <td>Atraso com definição única: concluída após o prazo ou em aberto com prazo vencido</td>
            </tr>
            <tr>
              <td>Aprovação no e-mail, sem autor nem data</td>
              <td>Aprovação por link, com nome, e-mail, data e observação</td>
            </tr>
            <tr>
              <td>Nada de histórico</td>
              <td>Histórico de mudanças por entrega, com autor</td>
            </tr>
            <tr>
              <td>Acesso aberto a quem tivesse a planilha</td>
              <td>Login por convite, com quatro papéis: admin, gestor, operador e leitor</td>
            </tr>
            <tr>
              <td>Dados duplicados e datas em quatro formatos</td>
              <td>Importação normalizada, com fila de revisão e nada apagado</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="muted">
        30,7% das 888 entregas comparáveis passaram do prazo (mediana de 6 dias,
        P90 de 21). Conteúdo é o tipo com maior taxa (41,1%), seguido de Análise
        (32,9%) e Relatório (15,9%). 71 entregas estão abertas com prazo vencido
        hoje.
      </p>

      <h2>O que ficou de fora</h2>
      <ul>
        <li>
          <strong>Alerta proativo de prazo</strong> — avisar o responsável antes
          do vencimento. É a próxima entrega.
        </li>
        <li>Exportação CSV e gráficos além dos indicadores de atraso.</li>
        <li>E-mail de comprovante ao cliente após a aprovação.</li>
        <li>Notificações e integração com o calendário.</li>
      </ul>

      <h2>Decisões que valem registro</h2>
      <ul>
        <li>
          <strong>Fase e aprovação são dimensões separadas.</strong> O status da
          planilha não respondia "onde está a entrega".
        </li>
        <li>
          <strong>Nada é apagado em silêncio.</strong> Duplicados e
          inconsistências vão para a fila de revisão.
        </li>
        <li>
          <strong>Cliente aprova por link, sem login.</strong> Token de uso único
          por etapa, expondo apenas aquela entrega.
        </li>
        <li>
          <strong>Modelo em estrela.</strong> Fatos e dimensões, com a regra de
          negócio no banco e RLS por papel.
        </li>
      </ul>

      <h2>Uso de IA</h2>
      <p className="muted">
        Código, migrations, testes e este documento foram escritos com OpenCode
        (agente de código) e revisados manualmente. Pontos revisados: inferência
        de ano em datas abreviadas, tratamento de revisões inválidas e a decisão
        de não apagar duplicados. Um teste encontrou um bug real no normalizador
        (um <code>-1</code> virava <code>1</code>), corrigido antes de gerar a
        base final. Nenhuma decisão de negócio foi delegada à IA.
      </p>

      <div className="links">
        <Link href="/login">Entrar no app</Link>
        <a href="/diagnostico.md" rel="noreferrer">
          Diagnóstico completo
        </a>
        <a href="/decisoes.md" rel="noreferrer">
          Decisões e premissas
        </a>
      </div>

      <footer>
        Dados fictícios, criados para o case. Stack: Supabase (Postgres, Auth,
        RLS), Next.js e Vercel.
      </footer>
    </main>
  );
}