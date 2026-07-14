import { resolvePostLoginPath } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils";
import { NextResponse } from "next/server";

/** Troca o código OAuth/e-mail por sessão e redireciona (com tratamento de erro). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const providerError = searchParams.get("error_description") || searchParams.get("error");
  const next = safeRedirectPath(searchParams.get("next"));
  // Confirmação da troca de e-mail (link enviado pelo /conta).
  const isEmailChange = searchParams.get("flow") === "email_change";

  // Provedor devolveu erro (usuário cancelou, escopo negado, etc.).
  if (providerError) {
    return NextResponse.redirect(
      isEmailChange ? `${origin}/conta?email=erro` : `${origin}/login?authError=oauth`,
    );
  }

  if (code && isSupabaseConfigured) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Na troca de e-mail o Supabase já aplicou a mudança antes de nos devolver o
    // controle. A troca do código só recria a sessão — e ela falha quando o link
    // é aberto em outro navegador (o verificador PKCE ficou no original). Nesse
    // caso o e-mail mudou do mesmo jeito, então não tratamos como erro.
    if (isEmailChange) {
      return NextResponse.redirect(`${origin}/conta?email=confirmado`);
    }

    if (error) {
      return NextResponse.redirect(`${origin}/login?authError=oauth`);
    }

    // Login social não traz WhatsApp — se faltar, completa o cadastro antes de seguir.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("whatsapp")
        .eq("id", user.id)
        .maybeSingle();
      if (!(profile?.whatsapp ?? "").trim()) {
        return NextResponse.redirect(`${origin}/completar-perfil?next=${encodeURIComponent(next)}`);
      }
      // Administrador entra direto no painel (exceto no fluxo de compra).
      const target = await resolvePostLoginPath(user.id, next);
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  // Sem código: se veio da confirmação de e-mail, a troca já foi aplicada.
  return NextResponse.redirect(
    isEmailChange ? `${origin}/conta?email=confirmado` : `${origin}${next}`,
  );
}
