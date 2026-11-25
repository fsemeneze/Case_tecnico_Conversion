import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import SairDoApp from "./sair-do-app";

// Layout do app interno: menu lateral, perfil e rota protegida.
// O proxy.ts já checa login + usuário ativo; aqui carregamos o perfil.
export default async function LayoutDoApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("usuario")
    .select("nome, email, papel")
    .eq("id", user.id)
    .maybeSingle();

  const nome = perfil?.nome ?? user.email;
  const papel = perfil?.papel ?? "leitor";

  return (
    <div className="app">
      <aside className="menu-lateral">
        <Link href="/inicio" className="marca">
          PlanOps
          <small>Planejamento e entregas</small>
        </Link>
        <nav>
          <Link href="/inicio">Início</Link>
          <Link href="/entregas">Entregas</Link>
          <Link href="/clientes">Clientes</Link>
          <Link href="/revisao">Revisão de dados</Link>
          <span className="secao">Administração</span>
          <Link href="/equipe">Equipe</Link>
        </nav>
        <div className="menu-usuario">
          <strong>{nome}</strong>
          {papel === "admin" ? "Administrador" : papel}
          <Link href="/sobre" className="link-sobre">
            Sobre o produto
          </Link>
          <Link href="/conta" className="link-sobre">
            Segurança da conta
          </Link>
          <SairDoApp />
        </div>
      </aside>
      <div className="conteudo">{children}</div>
    </div>
  );
}