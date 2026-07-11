"use client";

import { completeProfileAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

export function CompleteProfileForm({ next, defaultName }: { next: string; defaultName: string }) {
  const [state, formAction, pending] = useActionState(completeProfileAction, undefined);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">Quase lá</p>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.02em]">
          Completar cadastro
        </h1>
        <p className="text-sm text-muted-foreground">
          Precisamos do seu WhatsApp para enviar os avisos do pedido.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            defaultValue={defaultName}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputMode="tel"
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            required
          />
        </div>

        {state?.error && <Alert variant="error">{state.error}</Alert>}

        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="w-full uppercase tracking-[0.1em]"
        >
          {pending ? "Salvando..." : "Concluir"}
        </Button>
      </form>
    </div>
  );
}
