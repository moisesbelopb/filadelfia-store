import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-12 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Você está sem conexão</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Verifique sua internet e tente novamente. O que você já visitou pode continuar disponível.
      </p>
      <Link
        href="/"
        className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
      >
        Tentar novamente
      </Link>
    </div>
  );
}
