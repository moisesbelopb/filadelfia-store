"use client";

import { signupAction } from "@/actions/auth";
import { GoogleButton } from "@/components/auth/google-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authErrorMessage } from "@/lib/auth-errors";
import Link from "next/link";
import { useActionState } from "react";

export function SignupForm({ redirect, authError }: { redirect?: string; authError?: string }) {
  const [state, formAction, pending] = useActionState(signupAction, undefined);
  const loginHref = redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login";
  const oauthError = authErrorMessage(authError);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">Junte-se à Casa</p>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.02em]">
          Criar conta
        </h1>
        <p className="text-sm text-muted-foreground">
          É rápido. Usamos seu WhatsApp para avisos do pedido.
        </p>
      </div>

      {oauthError && <Alert variant="error">{oauthError}</Alert>}

      <GoogleButton redirect={redirect} />

      <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {redirect && <input type="hidden" name="redirect" value={redirect} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={6}
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
          {pending ? "Criando..." : "Criar conta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link
          href={loginHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
