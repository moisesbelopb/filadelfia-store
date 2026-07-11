import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type * as React from "react";

const VARIANTS = {
  error: { cls: "border-destructive/30 bg-destructive/10 text-destructive", Icon: AlertCircle },
  success: { cls: "border-success/30 bg-success/10 text-success", Icon: CheckCircle2 },
  info: { cls: "border-border bg-muted text-foreground", Icon: Info },
} as const;

type AlertProps = { variant?: keyof typeof VARIANTS } & React.ComponentProps<"div">;

/** Caixa de aviso inline (erro/sucesso/info) — acessível via role="alert". */
export function Alert({ variant = "info", className, children, ...props }: AlertProps) {
  const { cls, Icon } = VARIANTS[variant];
  return (
    <div
      role="alert"
      className={cn("flex items-start gap-2.5 rounded-md border p-3 text-sm", cls, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 leading-snug">{children}</div>
    </div>
  );
}
