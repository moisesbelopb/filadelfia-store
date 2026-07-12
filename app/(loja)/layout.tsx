import { BottomNav } from "@/components/loja/bottom-nav";
import { SiteFooter } from "@/components/loja/site-footer";
import { SiteHeader } from "@/components/loja/site-header";
import { ThemeStyle } from "@/components/theme-style";
import { getSetting } from "@/lib/queries/admin";
import type { VisualSettings } from "@/lib/theme";
import { Suspense } from "react";

export default async function LojaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const visual = await getSetting<VisualSettings>("visual");

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
