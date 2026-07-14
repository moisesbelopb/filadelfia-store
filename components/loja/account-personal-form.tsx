"use client";

import { updatePersonalAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { NameInput } from "@/components/ui/name-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "@/lib/use-toast";
import { type PersonalInput, personalSchema } from "@/lib/validators/account";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function AccountPersonalForm({ defaults }: { defaults: PersonalInput }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonalInput>({
    resolver: zodResolver(personalSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: PersonalInput) {
    const res = await updatePersonalAction(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
      return;
    }
    // Reaproveita os valores já normalizados pelo servidor como novo "estado limpo".
    reset(values);
    toast({ variant: "success", title: "Dados atualizados" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados pessoais</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          <Field label="Nome completo" error={errors.fullName?.message}>
            <NameInput {...register("fullName")} autoComplete="name" />
          </Field>
          <Field label="WhatsApp (com DDD)" error={errors.whatsapp?.message}>
            <PhoneInput {...register("whatsapp")} autoComplete="tel" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
