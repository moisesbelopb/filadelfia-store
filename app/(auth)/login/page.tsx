import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; authError?: string }>;
}) {
  const { redirect, authError } = await searchParams;
  return <LoginForm redirect={redirect} authError={authError} />;
}
