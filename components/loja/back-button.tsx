"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Botão "Voltar" que retorna para a página anterior do histórico (onde o
 * usuário realmente estava). Se não houver histórico no app (ex.: link aberto
 * direto), cai no `fallbackHref`.
 */
export function BackButton({
  fallbackHref,
  label = "Voltar",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="mb-5 flex w-fit items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="size-4" /> {label}
    </button>
  );
}
