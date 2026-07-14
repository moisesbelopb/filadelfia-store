"use client";

import { updateEmailAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/use-toast";
import { type EmailChangeInput, emailChangeSchema } from "@/lib/validators/account";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";

export function AccountEmailForm({
  email,
  pendingEmail,
  isGoogle,
}: {
  email: string;
  /** E-mail aguardando confirmação (o Supabase só troca depois do clique no link). */
  pendingEmail: string | null;
  isGoogle: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EmailChangeInput>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { email },
  });

  async function onSubmit(values: EmailChangeInput) {
    const res = await updateEmailAction(values);
    if (!res.ok) {
      toast({
        variant: "error",
        title: "Não foi possível trocar o e-mail",
        description: res.error,
      });
      return;
    }
    reset({ email });
    toast({
      variant: "success",
      title: "Confirme no seu e-mail",
      description: `Enviamos um link para ${res.data.sentTo}. A troca só vale depois que você clicar nele.`,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">E-mail de acesso</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {pendingEmail && (
          <p className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
            <MailCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              Troca pendente para <strong>{pendingEmail}</strong>. Abra o link que enviamos e
              confirme — até lá, continue entrando com <strong>{email}</strong>.
            </span>
          </p>
        )}

        {isGoogle ? (
          <Field label="E-mail" hint="Sua conta entra pelo Google — o e-mail é gerenciado por lá.">
            <div className="relative">
              <Input value={email} readOnly disabled className="bg-secondary/40 pr-10" />
              <Lock className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </Field>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
            <Field
              label="E-mail"
              error={errors.email?.message}
              hint="Enviamos um link de confirmação para o novo endereço. A troca só vale depois que você clicar nele."
            >
              <Input {...register("email")} type="email" autoComplete="email" />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Enviando..." : "Trocar e-mail"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
