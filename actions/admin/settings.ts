"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  deliverySettingsSchema,
  emailSettingsSchema,
  pixSettingsSchema,
  templateSchema,
  visualSettingsSchema,
} from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

async function upsertSetting(
  key: string,
  value: Record<string, unknown>,
  isPublic: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value, is_public: isPublic }, { onConflict: "key" });
  if (error) return fail(error.message);
  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, `settings.${key}`, "settings", key);
  return ok(undefined);
}

export async function savePixSettings(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = pixSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const res = await upsertSetting("pix", parsed.data, false);
  revalidatePath("/admin/configuracoes/whatsapp");
  return res;
}

export async function saveEmailSettings(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = emailSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const res = await upsertSetting("email", parsed.data, false);
  revalidatePath("/admin/configuracoes/whatsapp");
  return res;
}

export async function saveDeliverySettings(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = deliverySettingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const res = await upsertSetting("delivery", parsed.data, true);
  revalidatePath("/admin/configuracoes/entrega");
  revalidatePath("/checkout");
  return res;
}

export async function saveMessageTemplate(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .upsert(
      { key: parsed.data.key, name: parsed.data.name, body: parsed.data.body },
      { onConflict: "key" },
    );
  if (error) return fail(error.message);
  revalidatePath("/admin/configuracoes/whatsapp");
  return ok(undefined);
}

export async function saveVisualSettings(input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const parsed = visualSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");
  const res = await upsertSetting("visual", parsed.data, true);
  revalidatePath("/admin/configuracoes/visual");
  // Reaplica o tema em toda a loja (layout raiz do storefront).
  revalidatePath("/", "layout");
  return res;
}
