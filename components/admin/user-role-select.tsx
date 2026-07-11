"use client";

import { setUserRole } from "@/actions/admin/users";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/use-toast";
import type { UserRole } from "@/types/db";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function UserRoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as UserRole;
    startTransition(async () => {
      const res = await setUserRole({ userId, role: next });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        router.refresh(); // volta ao valor anterior
        return;
      }
      toast({ variant: "success", title: "Papel atualizado" });
      router.refresh();
    });
  }

  return (
    <Select
      value={role}
      onChange={onChange}
      disabled={disabled || pending}
      className="h-9 w-44 text-sm"
    >
      <option value="cliente">Cliente</option>
      <option value="admin">Administrador</option>
      <option value="super_admin">Super administrador</option>
    </Select>
  );
}
