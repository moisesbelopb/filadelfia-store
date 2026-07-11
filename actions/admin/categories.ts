"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { categorySchema, categoryUpdateSchema } from "@/lib/validators/admin";
import { revalidatePath } from "next/cache";

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

export async function createCategory(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; slug: string }>> {
  const g = await guard();
  if (g) return g;

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const base = slugify(parsed.data.name);
  if (!base) return fail("Nome de categoria inválido.");

  // slug único.
  const { data: taken } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((r: { slug: string }) => r.slug));
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;

  // Posição no fim da lista.
  const { data: last } = await supabase
    .from("categories")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last?.position as number | undefined) ?? -1) + 1;

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: parsed.data.name.trim(), slug, position })
    .select("id, name, slug")
    .single();
  if (error || !data) return fail(error?.message ?? "Falha ao criar categoria.");

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "category.create", "category", data.id);

  revalidatePath("/admin/produtos");
  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return ok(data as { id: string; name: string; slug: string });
}

/** Renomeia e/ou ativa/desativa uma categoria (o slug não muda, p/ não quebrar links). */
export async function updateCategory(id: string, input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const parsed = categoryUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
  if (Object.keys(patch).length === 0) return ok(undefined);

  const supabase = await createClient();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "category.update", "category", id);

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  return ok(undefined);
}

/** Exclui uma categoria. Os produtos ficam sem categoria (FK on delete set null). */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "category.delete", "category", id);

  revalidatePath("/admin/categorias");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  return ok(undefined);
}

/** Reordena movendo a categoria uma posição para cima/baixo (reatribui posições). */
export async function reorderCategory(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const supabase = await createClient();
  const { data: cats, error } = await supabase
    .from("categories")
    .select("id, position")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return fail(error.message);

  const list = (cats ?? []) as { id: string; position: number }[];
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return fail("Categoria não encontrada.");
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= list.length) return ok(undefined); // já na ponta

  const a = list[idx];
  const b = list[swap];
  if (!a || !b) return ok(undefined);
  list[idx] = b;
  list[swap] = a;

  // Reatribui posições sequenciais (evita colisões).
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item && item.position !== i) {
      const { error: upErr } = await supabase
        .from("categories")
        .update({ position: i })
        .eq("id", item.id);
      if (upErr) return fail(upErr.message);
    }
  }

  revalidatePath("/admin/categorias");
  revalidatePath("/");
  return ok(undefined);
}
