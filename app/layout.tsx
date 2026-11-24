import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entregas — Conversion | Case técnico",
  description:
    "Controle de entregas da Conversion: da planilha ao app. Diagnóstico dos dados e evolução do produto.",
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
