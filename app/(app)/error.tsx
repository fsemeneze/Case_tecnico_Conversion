"use client";

// Fronteira de erro do app interno. Falhas inesperadas (ex.: Supabase fora do
// ar) mostram uma tela de recuperação em vez de esconder o erro.
export default function ErroDoApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="cartao erro-tela">
      <h1>Algo deu errado</h1>
      <p className="muted">
        Não foi possível carregar esta tela. Tente novamente em instantes.
      </p>
      {error.digest && <p className="muted">Código: {error.digest}</p>}
      <div className="topo-acoes">
        <button type="button" className="botao primario" onClick={reset}>
          Tentar de novo
        </button>
        <a href="/inicio" className="botao secundario">
          Voltar ao início
        </a>
      </div>
    </div>
  );
}