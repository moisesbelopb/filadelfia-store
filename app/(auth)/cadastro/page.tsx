import { SignupForm } from "@/components/auth/signup-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; authError?: string }>;
}) {
  const { redirect, authError } = await searchParams;
  return <SignupForm redirect={redirect} authError={authError} />;
}
