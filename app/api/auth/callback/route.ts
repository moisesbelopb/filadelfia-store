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

  // Provedor devolveu erro (usuário cancelou, escopo negado, etc.).
  if (providerError) {
    return NextResponse.redirect(`${origin}/login?authError=oauth`);
  }

  if (code && isSupabaseConfigured) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
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
        .select("whatsapp, role")
        .eq("id", user.id)
        .maybeSingle();
      if (!(profile?.whatsapp ?? "").trim()) {
        return NextResponse.redirect(`${origin}/completar-perfil?next=${encodeURIComponent(next)}`);
      }
      // Administrador entra direto no painel (a menos que já haja um destino).
      const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
      if (next === "/" && isAdmin) {
        return NextResponse.redirect(`${origin}/admin`);
      }
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
