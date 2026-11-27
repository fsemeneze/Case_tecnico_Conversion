"use client";

import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabaseNavegador } from "@/lib/supabase/navegador";

type Fator = { id: string; friendly_name: string | null; status: string; created_at: string };
type Estado = { erro?: string; aviso?: string };

// Verificação em duas etapas (TOTP). O admin é o principal candidato:
// a conta dele concentra convites e gestão de papéis.
export default function Seguranca() {
  const [fatores, setFatores] = useState<Fator[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [segredo, setSegredo] = useState<string | null>(null);
  const [fatorNovo, setFatorNovo] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<Estado>({});

  const carregar = useCallback(async () => {
    const supabase = criarClienteSupabaseNavegador();
    const { data } = await supabase.auth.mfa.listFactors();
    setFatores((data?.all ?? []) as Fator[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function iniciarConfiguracao() {
    setEstado({});
    setQr(null);
    setSegredo(null);
    setCodigo("");
    const supabase = criarClienteSupabaseNavegador();
    // O Supabase recusa dois fatores com o mesmo friendly_name. Como pode
    // haver um fator antigo não verificado, o nome ganha um sufixo.
    const nomeFator = `PlanHub${fatores.length ? ` ${fatores.length + 1}` : ""}`;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: nomeFator,
    });
    if (error || !data) {
      // Mostra o motivo real: sem isso, a tela só diz "não foi possível"
      // e o time não sabe se é MFA desligado no projeto, sessão ou cota.
      const motivo =
        error?.message ??
        (data ? "sem dados do fator" : "erro desconhecido do provedor");
      const dica = /mfa|multi.factor/i.test(motivo)
        ? " Verifique se o MFA está habilitado em Authentication → Settings no painel do Supabase."
        : "";
      setEstado({
        erro: `Não foi possível iniciar a configuração: ${motivo}.${dica}`,
      });
      return;
    }
    setFatorNovo(data.id);
    setQr(data.totp?.qr_code ?? null);
    setSegredo(data.totp?.secret ?? null);
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!fatorNovo) return;
    setEstado({});
    const supabase = criarClienteSupabaseNavegador();

    const { data: desafio, error: erroDesafio } = await supabase.auth.mfa.challenge({
      factorId: fatorNovo,
    });
    if (erroDesafio || !desafio) {
      setEstado({ erro: "Não foi possível validar o código." });
      return;
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId: fatorNovo,
      challengeId: desafio.id,
      code: codigo.trim(),
    });
    if (error) {
      setEstado({ erro: "Código incorreto. Confira o aplicativo." });
      return;
    }

    setEstado({ aviso: "Verificação em duas etapas ativada." });
    setFatorNovo(null);
    setQr(null);
    setSegredo(null);
    setCodigo("");
    await carregar();
  }

  async function remover(id: string) {
    setEstado({});
    const supabase = criarClienteSupabaseNavegador();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      setEstado({ erro: "Não foi possível remover o fator." });
      return;
    }
    setEstado({ aviso: "Verificação em duas etapas removida." });
    await carregar();
  }

  const ativo = fatores.some((f) => f.status === "verified");

  return (
    <div className="cartao seguranca">
      <h2>Verificação em duas etapas</h2>
      <p className="muted">
        Um segundo fator além da senha. Recomendado para administradores, que
        concentram convites e gestão de papéis.
      </p>

      {carregando && <p className="muted">Carregando…</p>}

      {!carregando && ativo && (
        <>
          <p>
            <span className="badge tom-ok">Ativada</span>
          </p>
          <ul className="lista-chave">
            {fatores
              .filter((f) => f.status === "verified")
              .map((f) => (
                <li key={f.id}>
                  <span>{f.friendly_name ?? "Fator TOTP"}</span>
                  <button
                    type="button"
                    className="secundario"
                    onClick={() => remover(f.id)}
                  >
                    Remover
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {!carregando && !ativo && !fatorNovo && (
        <button type="button" onClick={iniciarConfiguracao}>
          Configurar autenticador
        </button>
      )}

      {fatorNovo && (
        <div className="mfa-novo">
          <p className="muted">
            Abra o aplicativo autenticador (Google Authenticator, 1Password,
            Authy) e leia o QR code. Se não conseguir, digite a chave manual.
          </p>
          {qr && (
            // QR code gerado pelo Supabase em data URI; a imagem é local.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="QR code do autenticador" width={180} height={180} />
          )}
          {segredo && (
            <p className="muted">
              Chave manual: <code>{segredo}</code>
            </p>
          )}
          <form onSubmit={confirmar} className="cartao-form">
            <label>
              Código de 6 dígitos
              <input
                type="text"
                inputMode="numeric"
                required
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
              />
            </label>
            <div className="botoes">
              <button type="submit" disabled={codigo.length !== 6}>
                Confirmar e ativar
              </button>
              <button
                type="button"
                className="secundario"
                onClick={() => {
                  setFatorNovo(null);
                  setQr(null);
                  setSegredo(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {estado.erro && <p className="erro">{estado.erro}</p>}
      {estado.aviso && <p className="aviso">{estado.aviso}</p>}
    </div>
  );
}