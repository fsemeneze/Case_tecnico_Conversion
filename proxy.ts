import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Porta de entrada do app interno (/entregas/**): exige login E perfil
// ativo em `usuario`. A página pública de aprovação (/aprovacao/**) fica fora.
// (Next 16: a convenção `middleware.ts` virou `proxy.ts`.)
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaDefinir) {
          // Escreve nos cookies da requisição E na resposta: o refresh de
          // sessão precisa vazar para o cliente, senão o acesso cai depois
          // do primeiro refresh.
          cookiesParaDefinir.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          resposta = NextResponse.next({ request });
          cookiesParaDefinir.forEach(({ name, value, options }) =>
            resposta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Usuário sem perfil ativo (convite pendente ou conta desativada) sai da
  // sessão e volta ao login, em vez de ver tela vazia.
  const { data: perfil } = await supabase
    .from("usuario")
    .select("id, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (!perfil || !perfil.ativo) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return resposta;
}

export const config = {
  matcher: [
    "/inicio",
    "/entregas",
    "/entregas/:path*",
    "/clientes",
    "/revisao",
    "/equipe",
  ],
};