import { AccountForm } from "@/components/admin/account-form";
import { NATIVE_ADMIN_EMAIL, getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Minha conta" };

// Dados da própria sessão — nunca cachear.
export const dynamic = "force-dynamic";

export default async function ContaPage() {
  const user = await getCurrentUser();
  const email = user?.email ?? "";
  const canChangeEmail = isSupabaseConfigured && email.toLowerCase() !== NATIVE_ADMIN_EMAIL;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 text-xl font-semibold">Minha conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Altere o e-mail e a senha do <strong>seu</strong> acesso ao painel. Por segurança, cada
          alteração pede a sua senha atual.
        </p>
      </div>

      {!isSupabaseConfigured ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Conecte o Supabase para gerenciar a sua conta.
        </div>
      ) : (
        <AccountForm email={email} canChangeEmail={canChangeEmail} />
      )}
    </div>
  );
}
