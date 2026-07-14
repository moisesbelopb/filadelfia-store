"use client";

import { completeProfileAction } from "@/actions/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NameInput } from "@/components/ui/name-input";
import { PhoneInput } from "@/components/ui/phone-input";
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
          <NameInput id="fullName" name="fullName" defaultValue={defaultName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="whatsapp">WhatsApp (com DDD)</Label>
          <PhoneInput id="whatsapp" name="whatsapp" required />
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
