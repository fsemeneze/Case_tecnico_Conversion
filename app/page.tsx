import metricas from "../analysis/out/metricas.json";

const numero = (valor: number | string, casas = 0) =>
  Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });

export default function Home() {
  const atraso = metricas.atraso;
  const fila = metricas.fila_revisao ?? 0;

  return (
    <main>
      <p className="eyebrow">Case técnico · Analista de BI (AI Builder)</p>
      <h1>Controle de entregas, da planilha ao app</h1>
      <p className="lead">
        Base de {numero(metricas.total_linhas_origem)} entregas da Conversion entre
        nov/2025 e out/2026. Esta primeira entrega cobre o diagnóstico dos dados e a
        estrutura do projeto; a modelagem e o app vêm nas próximas fases.
      </p>

      <div className="status">
        <span className="dot" aria-hidden="true" />
        Fases 0 e 1 concluídas
      </div>

      <div className="stats">
        <div className="stat">
          <span className="value">{numero(metricas.total_linhas_origem)}</span>
          <span className="label">linhas analisadas</span>
        </div>
        <div className="stat">
          <span className="value">{numero(metricas.clientes_canonicos)}</span>
          <span className="label">clientes após normalizar {metricas.clientes_brutos} grafias</span>
        </div>
        <div className="stat alert">
          <span className="value">{numero(atraso.taxa, 1)}%</span>
          <span className="label">
            {atraso.atrasadas} de {atraso.comparaveis} entregas após o prazo
          </span>
        </div>
        <div className="stat alert">
          <span className="value">{numero(atraso.abertas_em_atraso_hoje)}</span>
          <span className="label">entregas abertas com prazo vencido hoje</span>
        </div>
      </div>

      <h2>O que o diagnóstico encontrou</h2>
      <ul className="findings">
        <li>
          <span>
            {metricas.ids_duplicados_distintos} IDs repetidos e{" "}
            {metricas.contadores_qualidade?.possivel_duplicata ?? 0} linhas com assinatura
            idêntica, incluindo 10 registros fantasmas (IDs 986 a 995)
          </span>
          <span className="n">duplicidade</span>
        </li>
        <li>
          <span>
            22 valores de status para o mesmo processo: produção, espera e aprovação
            misturados na mesma coluna
          </span>
          <span className="n">status</span>
        </li>
        <li>
          <span>
            {metricas.contadores_qualidade?.link_repetido ?? 0} linhas com link repetido e{" "}
            {(metricas.contadores_qualidade?.sem_link ?? 0) +
              (metricas.contadores_qualidade?.link_textual ?? 0)}{" "}
            sem link de arquivo válido
          </span>
          <span className="n">rastreabilidade</span>
        </li>
        <li>
          <span>
            Datas em quatro formatos, incluindo serial do Excel e texto abreviado
            (&quot;10/nov&quot;)
          </span>
          <span className="n">datas</span>
        </li>
        <li>
          <span>{fila} linhas em fila de revisão antes da importação</span>
          <span className="n">qualidade</span>
        </li>
      </ul>

      <h2>Próximas fases</h2>
      <ol className="phases">
        <li className="current">
          <strong>Fase 2 — Modelagem:</strong> schema Postgres, separação de fase e
          aprovação, histórico por trigger e RLS.
        </li>
        <li>
          <strong>Fase 3 — Fatia funcional:</strong> lista com filtros e busca, cadastro e
          aprovação do cliente em duas etapas.
        </li>
        <li>
          <strong>Fase 4 — README de produto:</strong> o que migrou, o que mudou, o que
          ficou de fora e a próxima entrega.
        </li>
      </ol>

      <div className="links">
        <a href="/entregas">App de entregas (Fase 3)</a>
        <a href="/login">Entrar no app</a>
        <a href="/diagnostico.md">Diagnóstico completo</a>
        <a href="/decisoes.md">Decisões e premissas</a>
        <a href="/entregas_normalizadas.csv">Base normalizada (CSV)</a>
        <a href="/erros_qualidade.csv">Fila de revisão (CSV)</a>
      </div>

      <footer>
        Números gerados por <code>analysis/diagnostico.py</code> em{" "}
        {metricas.gerado_em.replace("T", " ")}. Dados fictícios, criados para o case.
      </footer>
    </main>
  );
}
