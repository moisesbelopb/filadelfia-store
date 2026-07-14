import { BottomNav } from "@/components/loja/bottom-nav";
import { SiteFooter } from "@/components/loja/site-footer";
import { SiteHeader } from "@/components/loja/site-header";
import { ThemeStyle } from "@/components/theme-style";
import { getVisualSettings } from "@/lib/queries/public-settings";
import { Suspense } from "react";

export default async function LojaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cacheado e sem cookies: antes esta única linha ia ao banco em toda página da
  // loja e, por ler cookies, forçava a vitrine inteira a render dinâmico.
  const visual = await getVisualSettings();

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] sm:pb-0">
      <ThemeStyle settings={visual} />
      <Suspense fallback={<div className="h-28 border-b" />}>
        <SiteHeader />
      </Suspense>

      <main className="w-full flex-1 overflow-x-hidden pb-24 sm:pb-16">{children}</main>

      <SiteFooter />

      <BottomNav />
    </div>
  );
}
