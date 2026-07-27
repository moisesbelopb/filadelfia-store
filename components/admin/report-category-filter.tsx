"use client";

import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";

/** Seletor de categoria que recorta o relatório, preservando o período atual. */
export function ReportCategoryFilter({
  categories,
  current,
  keep,
}: {
  categories: { id: string; name: string }[];
  current?: string;
  keep: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function go(cat: string) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) sp.set(k, v);
    if (cat) sp.set("cat", cat);
    const qs = sp.toString();
    router.push(qs ? `/admin/pedidos/relatorio?${qs}` : "/admin/pedidos/relatorio");
  }

  return (
    <div className="flex flex-col gap-1.5 print:hidden sm:max-w-xs">
      <label htmlFor="report-cat" className="text-xs font-medium text-muted-foreground">
        Categoria
      </label>
      <Select id="report-cat" value={current ?? ""} onChange={(e) => go(e.target.value)}>
        <option value="">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
