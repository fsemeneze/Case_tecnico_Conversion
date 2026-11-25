"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Item do menu lateral com destaque na rota atual.
export function ItemMenu({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const ativo = caminho === href || caminho.startsWith(`${href}/`);

  return (
    <Link href={href} className={ativo ? "ativo" : undefined}>
      {children}
    </Link>
  );
}