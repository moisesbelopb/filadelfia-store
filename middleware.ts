import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  /*
   * SÓ as rotas que dependem de sessão. O middleware chama supabase.auth.getUser(),
   * que é uma ida à rede — rodá-lo na vitrine (home, produto, login) cobrava esse
   * custo em toda navegação e em todo prefetch de <Link>, sem necessidade: o
   * cabeçalho e o carrinho são client components e não leem sessão no servidor.
   *
   * A sessão continua sendo renovada: ao entrar em qualquer uma destas rotas (ou
   * ao disparar uma Server Action), o token é revalidado e o cookie, reescrito.
   */
  matcher: ["/admin/:path*", "/checkout/:path*", "/pedidos/:path*", "/conta/:path*"],
};
