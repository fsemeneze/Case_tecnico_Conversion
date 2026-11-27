import { criarClienteSupabaseServidor } from "@/lib/supabase/servidor";
import { ConvidarUsuario } from "./convidar";
import { ControlesUsuario } from "./controles-usuario";

const ROTULO: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
  leitor: "Leitor",
};

export default async function Equipe() {
  const supabase = await criarClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: usuarios } = await supabase
    .from("usuario")
    .select("id, nome, email, papel, ativo, squad_id, criado_em")
    .order("criado_em", { ascending: true });

  const { data: squads } = await supabase
    .from("squads")
    .select("id, nome")
    .order("nome");

  const { data: convites } = await supabase
    .from("convite")
    .select("id, email, papel, valido_ate, usado_em, criado_em")
    .order("criado_em", { ascending: false })
    .limit(20);

  const ehAdmin = (usuarios ?? []).some(
    (u: { id: string; papel: string }) => u.id === user?.id && u.papel === "admin",
  );
  const listaSquads = squads ?? [];

  return (
    <>
      <header className="topo">
        <div>
          <h1>Equipe</h1>
        </div>
      </header>

      <p className="muted">
        Acesso por convite. O administrador define o papel de cada pessoa; o
        papel decide o que ela pode fazer no app.
      </p>

      {ehAdmin && <ConvidarUsuario squads={listaSquads} />}

      <h2>Pessoas</h2>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Situação</th>
              {ehAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u: {
              id: string;
              nome: string;
              email: string;
              papel: string;
              ativo: boolean;
              squad_id: number | null;
            }) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.nome}</strong>
                  {u.id === user?.id && <span className="muted"> (você)</span>}
                </td>
                <td className="muted">{u.email}</td>
                <td>{ROTULO[u.papel] ?? u.papel}</td>
                <td>
                  <span className={`badge tom-${u.ativo ? "ok" : "neutro"}`}>
                    {u.ativo ? "Ativo" : "Desativado"}
                  </span>
                </td>
                {ehAdmin && (
                  <td>
                    <ControlesUsuario
                      id={u.id}
                      papel={u.papel}
                      ativo={u.ativo}
                      ehProprio={u.id === user?.id}
                      squads={listaSquads}
                      squadId={u.squad_id}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(convites ?? []).length > 0 && (
        <>
          <h2>Convites</h2>
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Validade</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {(convites ?? []).map((c: {
                  id: string;
                  email: string;
                  papel: string;
                  valido_ate: string;
                  usado_em: string | null;
                }) => (
                  <tr key={c.id}>
                    <td>{c.email}</td>
                    <td>{ROTULO[c.papel] ?? c.papel}</td>
                    <td className="muted">
                      {new Date(c.valido_ate).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      <span className={`badge tom-${c.usado_em ? "ok" : "alerta"}`}>
                        {c.usado_em ? "Aceito" : "Pendente"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}