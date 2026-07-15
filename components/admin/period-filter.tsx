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
      <div className="flex flex-wrap gap-2">
        <PeriodPill href={hrefWith({ period: "hoje" })} active={active === "hoje"}>
          Hoje
        </PeriodPill>
        <PeriodPill href={hrefWith({ period: undefined })} active={active === "mes"}>
          Este mês
        </PeriodPill>
      </div>

      {/* GET p/ basePath?period=custom&...: preserva os demais filtros por hidden. */}
      <form action={basePath} className="flex flex-wrap items-end gap-2">
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
            className="h-9 w-auto"
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
            className="h-9 w-auto"
            aria-label="Data final"
          />
        </div>
        <Button
          type="submit"
          variant={active === "custom" ? "default" : "secondary"}
          size="sm"
          className="h-9"
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
  children,
}: {
  href: string;
  active: boolean;
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
      )}
    >
      {children}
    </Link>
  );
}
