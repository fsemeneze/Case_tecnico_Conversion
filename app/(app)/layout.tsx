import Link from "next/link";
import { redirect } from "next/navigation";
import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { Icone } from "@/app/icones";
import { TemaToggle } from "@/app/tema-toggle";
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

  const nome = String(perfil?.nome ?? user.email ?? "Você");
  const papel = perfil?.papel ?? "leitor";
  const iniciais = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");

  return (
    <div className="app">
      <aside className="menu-lateral">
        <Link href="/inicio" className="marca">
          <span className="marca-mark" aria-hidden="true" />
          <span>
            PlanOps
            <small>Planejamento e entregas</small>
          </span>
        </Link>
        <nav>
          <ItemMenu href="/inicio" icone="inicio">
            Início
          </ItemMenu>
          <ItemMenu href="/entregas" icone="entregas">
            Entregas
          </ItemMenu>
          <ItemMenu href="/clientes" icone="clientes">
            Clientes
          </ItemMenu>
          <ItemMenu href="/revisao" icone="revisao">
            Revisão de dados
          </ItemMenu>
          <span className="secao">Administração</span>
          <ItemMenu href="/equipe" icone="equipe">
            Equipe
          </ItemMenu>
          <ItemMenu href="/conta" icone="conta">
            Segurança da conta
          </ItemMenu>
        </nav>
        <div className="menu-usuario">
          <div className="usuario-topo">
            <span className="avatar" aria-hidden="true">
              {iniciais}
            </span>
            <span className="usuario-info">
              <strong>{nome}</strong>
              <span className="papel">
                {papel === "admin" ? "Administrador" : papel}
              </span>
            </span>
          </div>
          <div className="usuario-acoes">
            <TemaToggle />
            <Link href="/sobre">
              <Icone nome="info" width={17} height={17} />
              Sobre o produto
            </Link>
            <SairDoApp />
          </div>
        </div>
      </aside>
      <div className="conteudo">{children}</div>
    </div>
  );
}