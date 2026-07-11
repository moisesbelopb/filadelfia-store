"use client";

import { loginAction } from "@/actions/auth";
import { GoogleButton } from "@/components/auth/google-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { authErrorMessage } from "@/lib/auth-errors";
import Link from "next/link";
import { useActionState } from "react";

export function LoginForm({ redirect, authError }: { redirect?: string; authError?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const cadastroHref = redirect
    ? `/cadastro?redirect=${encodeURIComponent(redirect)}`
    : "/cadastro";
  const oauthError = authErrorMessage(authError);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">Bem-vindo de volta</p>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.02em]">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse sua conta para finalizar o pedido.</p>
      </div>

      {oauthError && <Alert variant="error">{oauthError}</Alert>}

      <GoogleButton redirect={redirect} />

      <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.14em] text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {redirect && <input type="hidden" name="redirect" value={redirect} />}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>

        {state?.error && <Alert variant="error">{state.error}</Alert>}

        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="w-full uppercase tracking-[0.1em]"
        >
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Não tem conta?{" "}
        <Link
          href={cadastroHref}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
