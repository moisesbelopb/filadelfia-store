"use client";

import { createAdminUser } from "@/actions/admin/users";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/use-toast";
import { type CreateUserInput, createUserSchema } from "@/lib/validators/admin";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function UserCreateForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: "", email: "", password: "", role: "admin" },
  });

  async function onSubmit(values: CreateUserInput) {
    const res = await createAdminUser(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível criar", description: res.error });
      return;
    }
    toast(
      res.data.promoted
        ? {
            variant: "success",
            title: "Cliente promovido a administrador",
            description: `${res.data.name} agora acessa o painel (mantém a senha atual).`,
          }
        : { variant: "success", title: "Usuário criado", description: values.email },
    );
    reset();
    router.refresh();
  }

  return (
    <Card>
      <CardIconHeader
        icon={UserPlus}
        title="Novo administrador"
        description="Crie um acesso ao painel administrativo."
      />
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input {...register("name")} autoComplete="off" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>E-mail</Label>
            <Input type="email" {...register("email")} autoComplete="off" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Senha</Label>
            <PasswordInput {...register("password")} autoComplete="new-password" />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Papel</Label>
            <Select {...register("role")}>
              <option value="admin">Administrador</option>
              <option value="super_admin">Super administrador</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Criando..." : "Criar usuário"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
