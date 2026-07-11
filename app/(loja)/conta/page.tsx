import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { ClipboardList, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="text-lg font-semibold">Entre na sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Faça login para ver seus pedidos e finalizar compras.
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

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Olá, {profile.full_name ?? "cliente"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          {profile.whatsapp && <p>WhatsApp: {profile.whatsapp}</p>}
          <p className="capitalize">Perfil: {profile.role.replace("_", " ")}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
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
