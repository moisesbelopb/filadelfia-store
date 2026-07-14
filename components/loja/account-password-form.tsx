"use client";

import { updatePasswordAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/lib/use-toast";
import { type PasswordChangeInput, passwordChangeSchema } from "@/lib/validators/account";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

/** `hasPassword=false` = conta criada pelo Google, que ainda não tem senha. */
export function AccountPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(values: PasswordChangeInput) {
    const res = await updatePasswordAction(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível alterar", description: res.error });
      return;
    }
    reset({ password: "", confirm: "" });
    toast({
      variant: "success",
      title: hasPassword ? "Senha alterada" : "Senha criada",
      description: "Use a nova senha no próximo login.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{hasPassword ? "Senha" : "Criar uma senha"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
          {!hasPassword && (
            <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              Você entra pelo Google. Se criar uma senha, poderá entrar também com{" "}
              <strong>e-mail e senha</strong> — o login pelo Google continua funcionando.
            </p>
          )}
          <Field label="Nova senha" error={errors.password?.message}>
            <PasswordInput {...register("password")} autoComplete="new-password" />
          </Field>
          <Field label="Repita a nova senha" error={errors.confirm?.message}>
            <PasswordInput {...register("confirm")} autoComplete="new-password" />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : hasPassword ? "Alterar senha" : "Criar senha"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
