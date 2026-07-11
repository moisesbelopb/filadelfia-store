import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Cabeçalho de card com ícone em destaque — padrão visual do admin.
 * `iconClassName` permite tingir o ícone (ex.: text-success) sem mudar o resto.
 */
export function CardIconHeader({
  icon: Icon,
  title,
  description,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconClassName?: string;
}) {
  return (
    <CardHeader>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground",
            iconClassName,
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
      </div>
    </CardHeader>
  );
}
