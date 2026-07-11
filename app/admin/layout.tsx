import { signOutAction } from "@/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { Store } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defesa em profundidade: o middleware já barra, mas revalidamos aqui.
  // Em modo demonstração (sem Supabase) liberamos para pré-visualizar a UI.
  if (isSupabaseConfigured && !(await isAdminUser())) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 print:hidden">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            aria-label="Casa de Filadélfia — Admin"
            className="flex shrink-0 items-center gap-3"
          >
            <Image
              src="/logo.png"
              alt="Casa de Filadélfia"
              width={884}
              height={355}
              priority
              className="h-8 w-auto sm:h-9 dark:brightness-0 dark:invert"
            />
            <span aria-hidden className="h-5 w-px bg-border" />
            <span className="eyebrow">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <Store className="size-4" /> <span className="hidden sm:inline">Ver loja</span>
              </Link>
            </Button>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:gap-6 lg:px-8">
        <aside className="lg:w-56 lg:shrink-0 lg:border-r lg:border-border lg:pr-6 print:hidden">
          <div className="lg:sticky lg:top-20">
            <p className="eyebrow mb-3 hidden px-1 lg:block">Navegação</p>
            <AdminNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
