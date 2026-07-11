import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { getProfile } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/utils";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Completar cadastro" };

export default async function CompletarPerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextParam } = await searchParams;
  const next = safeRedirectPath(nextParam);

  const profile = await getProfile();
  if (!profile) {
    redirect(`/login?redirect=${encodeURIComponent(`/completar-perfil?next=${next}`)}`);
  }
  // Já tem WhatsApp: nada a completar.
  if ((profile.whatsapp ?? "").trim()) redirect(next);

  return <CompleteProfileForm next={next} defaultName={profile.full_name ?? ""} />;
}
