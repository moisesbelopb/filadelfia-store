import { signOutAction } from "@/actions/auth";
import { AccountAddressForm } from "@/components/loja/account-address-form";
import { AccountEmailForm } from "@/components/loja/account-email-form";
import { AccountPasswordForm } from "@/components/loja/account-password-form";
import { AccountPersonalForm } from "@/components/loja/account-personal-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { authProviders, getCurrentUser, getProfile } from "@/lib/auth";
import { DEFAULT_DELIVERY_SETTINGS } from "@/lib/orders/delivery";
import { getSetting } from "@/lib/queries/admin";
import type { Address, DeliverySettings } from "@/types/db";
import { ClipboardList, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Minha conta" };

/** Iniciais para o avatar (ex.: "Moises Da Silva Belo" → "MB"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const [user, profile, delivery, { email: emailFlow }] = await Promise.all([
    getCurrentUser(),
    getProfile(),
    getSetting<DeliverySettings>("delivery"),
    searchParams,
  ]);

  if (!user || !profile) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Entre na sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Faça login para ver seus dados, seus pedidos e finalizar compras.
        </p>
        <Button asChild className="w-full">
          <Link href="/login?redirect=/conta">
            <LogIn /> Entrar
          </Link>
        </Button>
      </div>
    );
  }

  const isAdmin = profile.role === "admin" || profile.role === "super_admin";
  const providers = authProviders(user);
  const isGoogle = providers.includes("google");
  const email = user.email ?? "";
  const name = profile.full_name ?? "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <header className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
          {initials(name || email)}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{name || "Minha conta"}</h1>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
        </div>
      </header>

      {emailFlow === "confirmado" && (
        <Alert variant="success">
          <strong>E-mail confirmado.</strong> A partir de agora, entre com o novo endereço.
        </Alert>
      )}
      {emailFlow === "erro" && (
        <Alert variant="error">
          Não foi possível confirmar a troca de e-mail. O link pode ter expirado — peça a troca de
          novo abaixo.
        </Alert>
      )}

      <AccountPersonalForm defaults={{ fullName: name, whatsapp: profile.whatsapp ?? "" }} />

      <AccountEmailForm email={email} pendingEmail={user.new_email ?? null} isGoogle={isGoogle} />

      <AccountAddressForm
        address={profile.default_address as Address | null}
        delivery={delivery ?? DEFAULT_DELIVERY_SETTINGS}
      />

      <AccountPasswordForm hasPassword={providers.includes("email")} />

      <div className="flex flex-col gap-2 pt-2">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/pedidos">
            <ClipboardList /> Meus pedidos
          </Link>
        </Button>
        {isAdmin && (
          <Button asChild variant="outline" className="justify-start">
            <Link href="/admin">
              <LayoutDashboard /> Painel administrativo
            </Link>
          </Button>
        )}
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full justify-start text-destructive">
            <LogOut /> Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
