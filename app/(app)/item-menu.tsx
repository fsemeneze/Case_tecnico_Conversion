"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone, type NomeIcone } from "@/app/icones";

// Item do menu lateral com ícone e destaque na rota atual.
export function ItemMenu({
  href,
  icone,
  children,
}: {
  href: string;
  icone: NomeIcone;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const ativo = caminho === href || caminho.startsWith(`${href}/`);

  return (
    <Link href={href} className={ativo ? "ativo" : undefined}>
      <Icone nome={icone} />
      <span>{children}</span>
    </Link>
  );
}