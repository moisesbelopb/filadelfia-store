import { BottomNav } from "@/components/loja/bottom-nav";
import { SiteHeader } from "@/components/loja/site-header";
import { ThemeStyle } from "@/components/theme-style";
import { getSetting } from "@/lib/queries/admin";
import type { VisualSettings } from "@/lib/theme";
import Link from "next/link";
import { Suspense } from "react";

export default async function LojaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const visual = await getSetting<VisualSettings>("visual");

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <ThemeStyle settings={visual} />
      <Suspense fallback={<div className="h-28 border-b" />}>
        <SiteHeader />
      </Suspense>

      <main className="w-full flex-1 overflow-x-hidden pb-24 sm:pb-16">{children}</main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <p className="font-display text-sm font-bold uppercase tracking-[0.2em]">
              Casa de Filadélfia
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Coleção Multiplicação. Peça pelo celular, pague na entrega e acompanhe seu pedido.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="eyebrow">Comprar</p>
            <Link href="/?cat=feminino" className="text-muted-foreground hover:text-foreground">
              Feminino
            </Link>
            <Link href="/?cat=masculino" className="text-muted-foreground hover:text-foreground">
              Masculino
            </Link>
            <Link href="/?cat=infantil" className="text-muted-foreground hover:text-foreground">
              Infantil
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="eyebrow">Ajuda</p>
            <Link href="/pedidos" className="text-muted-foreground hover:text-foreground">
              Meus pedidos
            </Link>
            <Link href="/conta" className="text-muted-foreground hover:text-foreground">
              Minha conta
            </Link>
            <Link href="/privacidade" className="text-muted-foreground hover:text-foreground">
              Política de privacidade
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-[1600px] flex-col items-center justify-between gap-2 border-t border-border px-4 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 Solution Sistema. Todos os direitos reservados.</p>
          <p>
            Desenvolvido por{" "}
            <a
              href="https://www.solutionsistema.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground transition-colors hover:underline"
            >
              Solution Sistema
            </a>
          </p>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
