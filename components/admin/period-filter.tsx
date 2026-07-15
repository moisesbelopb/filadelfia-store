import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PeriodKey } from "@/lib/dashboard-period";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Filtro de período reutilizável (Hoje / Este mês / intervalo personalizado).
 * Server-friendly: atalhos são Links e o intervalo é um form GET — sem JS no
 * cliente. `params` são outros filtros da página (status, busca) que devem ser
 * preservados ao trocar o período, e vice-versa.
 */
export function PeriodFilter({
  basePath,
  active,
  from,
  to,
  params = {},
}: {
  basePath: string;
  active: PeriodKey;
  from: string;
  to: string;
  params?: Record<string, string | undefined>;
}) {
  const hrefWith = (extra: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) {
      if (v) sp.set(k, v);
    }
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      {/* Atalhos: dividem a linha no mobile (parecem um seletor), naturais no desktop. */}
      <div className="flex gap-2">
        <PeriodPill
          href={hrefWith({ period: "hoje" })}
          active={active === "hoje"}
          className="flex-1 text-center sm:flex-none"
        >
          Hoje
        </PeriodPill>
        <PeriodPill
          href={hrefWith({ period: undefined })}
          active={active === "mes"}
          className="flex-1 text-center sm:flex-none"
        >
          Este mês
        </PeriodPill>
      </div>

      {/* GET p/ basePath?period=custom&...: preserva os demais filtros por hidden.
          Mobile: De/Até lado a lado + Aplicar em largura total. Desktop: em linha. */}
      <form action={basePath} className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
        <input type="hidden" name="period" value="custom" />
        {Object.entries(params).map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null,
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="period-from" className="text-xs text-muted-foreground">
            De
          </label>
          <Input
            id="period-from"
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 w-full sm:w-auto"
            aria-label="Data inicial"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="period-to" className="text-xs text-muted-foreground">
            Até
          </label>
          <Input
            id="period-to"
            type="date"
            name="to"
            defaultValue={to}
            className="h-9 w-full sm:w-auto"
            aria-label="Data final"
          />
        </div>
        <Button
          type="submit"
          variant={active === "custom" ? "default" : "secondary"}
          size="sm"
          className="col-span-2 h-9 sm:col-span-1"
        >
          Aplicar
        </Button>
      </form>
    </div>
  );
}

function PeriodPill({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:bg-secondary",
        className,
      )}
    >
      {children}
    </Link>
  );
}
