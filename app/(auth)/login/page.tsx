import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, resolvePostLoginPath } from "@/lib/auth";
import type { Metadata } from "next";
import { redirect as goTo } from "next/navigation";

export const metadata: Metadata = { title: "Entrar" };

/**
 * Só aceita caminho interno. Barra dupla (`//host`) é URL protocolo-relativa —
 * seria um open redirect para fora do site.
 */
function safePath(path?: string): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; authError?: string }>;
}) {
  const { redirect, authError } = await searchParams;

  // Já logado: não mostra o formulário de novo (ex.: cliente que clicou no
  // botão do e-mail). Vai ao destino pedido ou ao padrão do seu papel.
  const user = await getCurrentUser();
  if (user) {
    const target = safePath(redirect);
    goTo(target ?? (await resolvePostLoginPath(user.id, "/")));
  }

  return <LoginForm redirect={redirect} authError={authError} />;
}
