"use client";

import { Button } from "@/components/ui/button";
import type { BreakdownRow } from "@/lib/queries/admin";
import { Download } from "lucide-react";

/** Baixa o relatório como CSV (separador ";" + BOM — abre certo no Excel BR). */
export function ReportExportButton({
  sections,
  filename,
}: {
  sections: { name: string; rows: BreakdownRow[] }[];
  filename: string;
}) {
  function download() {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = ["Dimensão;Item;Unidades;Pedidos"];
    for (const sec of sections) {
      for (const r of sec.rows) {
        lines.push([sec.name, r.label, r.units, r.orders].map(esc).join(";"));
      }
    }
    // ﻿ (BOM) faz o Excel reconhecer UTF-8 e mostrar acentos corretamente.
    const blob = new Blob([`﻿${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={download}
      className="print:hidden"
      disabled={sections.every((s) => s.rows.length === 0)}
    >
      <Download className="size-4" /> Exportar CSV
    </Button>
  );
}
