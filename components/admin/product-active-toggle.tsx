"use client";

import { toggleProductActive } from "@/actions/admin/products";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/use-toast";
import { useTransition } from "react";

export function ProductActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await toggleProductActive(id, !isActive);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
    });
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} aria-label="Alternar ativo">
      <Badge variant={isActive ? "success" : "muted"}>{isActive ? "Ativo" : "Inativo"}</Badge>
    </button>
  );
}
