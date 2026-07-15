"use client";

import { changeMyEmail, changeMyPassword } from "@/actions/admin/account";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/lib/use-toast";
import {
  type ChangeEmailInput,
  type ChangePasswordInput,
  changeEmailSchema,
  changePasswordSchema,
} from "@/lib/validators/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { AtSign, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function AccountForm({ email }: { email: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EmailCard email={email} />
      <PasswordCard />
    </div>
  );
}

function EmailCard({ email }: { email: string }) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { currentPassword: "", newEmail: "" },
  });

  async function onSubmit(values: ChangeEmailInput) {
    const res = await changeMyEmail(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível alterar", description: res.error });
      return;
    }
    toast({
      variant: "success",
      title: "E-mail alterado",
      description: `Seu novo acesso é ${res.data}.`,
    });
    reset({ currentPassword: "", newEmail: "" });
    router.refresh();
  }

  return (
    <Card>
      <CardIconHeader
        icon={AtSign}
        title="Alterar e-mail"
        description="Este é o e-mail usado para entrar no painel."
      />
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>E-mail atual</Label>
            <Input value={email} disabled readOnly />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newEmail">Novo e-mail</Label>
            <Input id="newEmail" type="email" autoComplete="off" {...register("newEmail")} />
            {errors.newEmail && (
              <p className="text-xs text-destructive">{errors.newEmail.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emailCurrentPassword">Senha atual (para confirmar)</Label>
            <PasswordInput
              id="emailCurrentPassword"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? "Alterando..." : "Alterar e-mail"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordInput) {
    const res = await changeMyPassword(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível alterar", description: res.error });
      return;
    }
    toast({
      variant: "success",
      title: "Senha alterada",
      description: "Use a nova senha no próximo login.",
    });
    reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }

  return (
    <Card>
      <CardIconHeader
        icon={KeyRound}
        title="Alterar senha"
        description="Escolha uma senha forte, com ao menos 8 caracteres."
      />
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
            {errors.currentPassword && (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              {...register("newPassword")}
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
