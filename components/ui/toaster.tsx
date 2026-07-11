"use client";

import { useToastStore } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

const iconByVariant = {
  default: Info,
  success: CheckCircle2,
  error: AlertCircle,
} as const;

const colorByVariant = {
  default: "text-primary",
  success: "text-success",
  error: "text-destructive",
} as const;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
      {toasts.map((t) => {
        const Icon = iconByVariant[t.variant];
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-card p-4 shadow-lg"
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", colorByVariant[t.variant])} />
            <div className="min-w-0 flex-1">
              {t.title && <p className="font-medium text-sm">{t.title}</p>}
              {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100"
              aria-label="Fechar aviso"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
