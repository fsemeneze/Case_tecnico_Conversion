import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Aplica o tema antes da pintura para evitar flash: preferência salva ou,
// na primeira visita, o tema do sistema.
const TEMA_INICIAL = `(function(){try{var t=localStorage.getItem('tema');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "PlanOps — Planejamento e entregas",
  description:
    "Planejamento e controle de entregas, com aprovação do cliente em duas etapas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} ${jakarta.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
        {children}
      </body>
    </html>
  );
}