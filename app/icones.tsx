import type { SVGProps } from "react";

// Conjunto de ícones do PlanOps: SVG autoral, traço único (1.75), cantos
// arredondados, cor herdada (currentColor). Nada de emoji ou glifo Unicode
// fazendo vez de ícone.
export type NomeIcone =
  | "inicio"
  | "entregas"
  | "clientes"
  | "revisao"
  | "equipe"
  | "conta"
  | "sair"
  | "voltar"
  | "mais"
  | "busca"
  | "externo"
  | "check"
  | "info"
  | "sol"
  | "lua";

const CAMINHOS: Record<NomeIcone, React.ReactNode> = {
  inicio: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  entregas: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  clientes: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.5a5.5 5.5 0 0 1 3 5" />
    </>
  ),
  revisao: (
    <>
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4h.01" />
    </>
  ),
  equipe: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  conta: (
    <>
      <path d="M12 3 20 6v5.5c0 4.5-3.2 7.6-8 9-4.8-1.4-8-4.5-8-9V6z" />
      <path d="M9.5 12 11.2 13.8 15 10" />
    </>
  ),
  sair: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8 6 12l4 4" />
      <path d="M6 12h9" />
    </>
  ),
  voltar: <path d="M15 5 8 12l7 7" />,
  mais: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  busca: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.6-3.6" />
    </>
  ),
  externo: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  check: <path d="M5 12.5 10 17.5 19 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  sol: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2" />
      <path d="M12 19.5v2" />
      <path d="M4.2 4.2l1.4 1.4" />
      <path d="M18.4 18.4l1.4 1.4" />
      <path d="M2.5 12h2" />
      <path d="M19.5 12h2" />
      <path d="M4.2 19.8l1.4-1.4" />
      <path d="M18.4 5.6l1.4-1.4" />
    </>
  ),
  lua: <path d="M20 14.5A8 8 0 0 1 9.5 4a6.5 6.5 0 1 0 10.5 10.5z" />,
};

export function Icone({
  nome,
  ...props
}: { nome: NomeIcone } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {CAMINHOS[nome]}
    </svg>
  );
}