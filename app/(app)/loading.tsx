// Skeleton genérico do app interno. Enquanto a página carrega os dados do
// Supabase, mostramos o formato da tela (topo, cartões, tabela) para a
// navegação parecer instantânea em vez de uma tela em branco.
export default function Carregando() {
  return (
    <div className="skeleton" aria-busy="true" aria-live="polite">
      <header className="topo">
        <div className="skeleton-linha skeleton-titulo" />
      </header>

      <div className="stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat">
            <span className="skeleton-linha skeleton-num" />
            <span className="skeleton-linha skeleton-rotulo" />
          </div>
        ))}
      </div>

      <div className="tabela-wrap">
        <table className="tabela">
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={6}>
                  <span className="skeleton-linha skeleton-linha-tabela" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}