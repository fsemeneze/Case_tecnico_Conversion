// Formulário de cliente (server component) usado no cadastro e na edição.
// A ação é uma Server Action passada por prop.

export type ClienteForm = {
  id?: number;
  nome?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  uf?: string | null;
  contato_nome?: string | null;
  observacoes?: string | null;
  ativo?: boolean | null;
};

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export function FormularioCliente({
  acao,
  cliente,
  botao,
}: {
  acao: (formulario: FormData) => void | Promise<void>;
  cliente?: ClienteForm;
  botao: string;
}) {
  return (
    <form action={acao} className="cartao-form">
      {cliente?.id && <input type="hidden" name="id" value={cliente.id} />}

      <label>
        Nome canônico *
        <input name="nome" required defaultValue={cliente?.nome ?? ""} placeholder="Ex.: Banco Prisma" />
      </label>

      <label>
        Nome fantasia
        <input name="nome_fantasia" defaultValue={cliente?.nome_fantasia ?? ""} placeholder="Como o cliente se apresenta" />
      </label>

      <label>
        CNPJ
        <input name="cnpj" defaultValue={cliente?.cnpj ?? ""} placeholder="00.000.000/0000-00" />
      </label>

      <label>
        E-mail
        <input name="email" type="email" defaultValue={cliente?.email ?? ""} placeholder="contato@cliente.com.br" />
      </label>

      <label>
        Telefone
        <input name="telefone" defaultValue={cliente?.telefone ?? ""} placeholder="(11) 4000-0000" />
      </label>

      <label>
        Cidade
        <input name="cidade" defaultValue={cliente?.cidade ?? ""} placeholder="São Paulo" />
      </label>

      <label>
        UF
        <select name="uf" defaultValue={cliente?.uf ?? ""}>
          <option value="">—</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </label>

      <label>
        Contato responsável
        <input name="contato_nome" defaultValue={cliente?.contato_nome ?? ""} placeholder="Nome de quem fala pelo cliente" />
      </label>

      <label>
        Observações
        <textarea name="observacoes" rows={3} defaultValue={cliente?.observacoes ?? ""} placeholder="Notas internas sobre o cliente" />
      </label>

      <label className="filtro-check">
        <input type="checkbox" name="ativo" defaultChecked={cliente?.ativo ?? true} />
        Cliente ativo
      </label>

      <div className="botoes">
        <button type="submit">{botao}</button>
      </div>
    </form>
  );
}