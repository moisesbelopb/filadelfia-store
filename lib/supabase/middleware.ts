import { SUPABASE_ANON_KEY_SAFE, SUPABASE_URL_SAFE, isSupabaseConfigured } from "@/lib/env";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const ADMIN_PREFIX = "/admin";
const CLIENTE_PROTECTED = ["/checkout", "/pedidos", "/conta"];

/**
 * Renova a sessão do Supabase a cada request e protege rotas.
 * Sem Supabase configurado, apenas segue (modo vazio).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL_SAFE, SUPABASE_ANON_KEY_SAFE, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Rotas do cliente que exigem login.
  if (!user && CLIENTE_PROTECTED.some((p) => path.startsWith(p))) {
    return redirectTo(request, "/login", path);
  }

  // Admin: exige login + role admin/super_admin.
  if (path.startsWith(ADMIN_PREFIX)) {
    if (!user) return redirectTo(request, "/login", path);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "super_admin"].includes(profile.role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

function redirectTo(request: NextRequest, pathname: string, from?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  if (from) url.searchParams.set("redirect", from);
  return NextResponse.redirect(url);
}
