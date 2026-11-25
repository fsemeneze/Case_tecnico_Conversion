import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import SairDoApp from "./sair-do-app";
import { ItemMenu } from "./item-menu";

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
          <ItemMenu href="/inicio">Início</ItemMenu>
          <ItemMenu href="/entregas">Entregas</ItemMenu>
          <ItemMenu href="/clientes">Clientes</ItemMenu>
          <ItemMenu href="/revisao">Revisão de dados</ItemMenu>
          <span className="secao">Administração</span>
          <ItemMenu href="/equipe">Equipe</ItemMenu>
          <ItemMenu href="/conta">Segurança da conta</ItemMenu>
        </nav>
        <div className="menu-usuario">
          <strong>{nome}</strong>
          {papel === "admin" ? "Administrador" : papel}
          <Link href="/sobre" className="link-sobre">
            Sobre o produto
          </Link>
          <SairDoApp />
        </div>
      </aside>
      <div className="conteudo">{children}</div>
    </div>
  );
}