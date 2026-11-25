import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlanOps — Planejamento e entregas",
  description:
    "PlanOps: planejamento e controle de entregas, com aprovação do cliente em duas etapas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
