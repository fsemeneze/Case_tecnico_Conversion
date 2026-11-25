"use client";

import { useState, useTransition } from "react";
import { convidarUsuario } from "./actions";

export function ConvidarUsuario() {
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("operador");
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setOk(null);
    iniciar(async () => {
      const r = await convidarUsuario(email.trim(), papel);
      if (r.ok) {
        setOk(`Convite enviado para ${email.trim()}.`);
        setEmail("");
      } else {
        setErro(r.erro ?? "Não foi possível convidar.");
      }
    });
  }

  return (
    <form onSubmit={enviar} className="cartao-form convite-form">
      <h2>Convidar pessoa</h2>
      <p className="muted">
        O convite vale 7 dias. A pessoa define a senha no link recebido.
      </p>
      <label>
        E-mail
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pessoa@conversion.com.br"
        />
      </label>
      <label>
        Papel
        <select value={papel} onChange={(e) => setPapel(e.target.value)}>
          <option value="operador">Operador</option>
          <option value="gestor">Gestor</option>
          <option value="leitor">Leitor</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      {ok && <p className="aviso">{ok}</p>}
      <button type="submit" disabled={pendente}>
        {pendente ? "Enviando…" : "Convidar"}
      </button>
    </form>
  );
}