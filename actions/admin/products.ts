"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATALOG_TAG } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { productSchema, productVariantsSchema } from "@/lib/validators/admin";
import { revalidatePath, revalidateTag } from "next/cache";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (g) return g;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const supabase = await createClient();
  const slug = await uniqueSlug(supabase, slugify(d.name));

  const { data, error } = await supabase
    .from("products")
    .insert({
      name: d.name,
      slug,
      category_id: d.categoryId ?? null,
      description_short: d.descriptionShort ?? null,
      description_long: d.descriptionLong ?? null,
      price: d.price,
      stock: d.stock ?? 0,
      color_name: d.colorName?.trim() || null,
      color_hex: d.colorHex || null,
      color_group: d.colorGroup?.trim() || null,
      is_active: d.isActive,
      is_featured: d.isFeatured,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Falha ao criar produto.");

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "product.create", "product", data.id);

  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok({ id: data.id });
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    // Estoque não é gravado aqui: ele é derivado das variantes (tamanhos).
    .update({
      name: d.name,
      category_id: d.categoryId ?? null,
      description_short: d.descriptionShort ?? null,
      description_long: d.descriptionLong ?? null,
      price: d.price,
      color_name: d.colorName?.trim() || null,
      color_hex: d.colorHex || null,
      color_group: d.colorGroup?.trim() || null,
      is_active: d.isActive,
      is_featured: d.isFeatured,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "product.update", "product", id);

  revalidatePath("/admin/produtos");
  revalidatePath(`/admin/produtos/${id}`);
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

/**
 * Salva os tamanhos (variantes) do produto e o estoque de cada um.
 * Faz upsert por (produto, tamanho) — preservando ids de tamanhos mantidos —
 * e remove só os tamanhos que saíram da lista. O gatilho do banco recalcula
 * `products.stock` como a soma das variantes.
 */
export async function saveProductVariants(
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const parsed = productVariantsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  // Normaliza tamanhos (maiúsculo, sem espaços) e descarta duplicados.
  const seen = new Set<string>();
  const rows: { product_id: string; size: string; stock: number; position: number }[] = [];
  for (const v of parsed.data.variants) {
    const size = v.size.trim().toUpperCase();
    if (!size || seen.has(size)) continue;
    seen.add(size);
    rows.push({ product_id: productId, size, stock: v.stock, position: rows.length });
  }

  const supabase = await createClient();

  // Remove apenas os tamanhos que saíram (mantém os ids dos que ficaram).
  const { data: existing, error: readErr } = await supabase
    .from("product_variants")
    .select("id, size")
    .eq("product_id", productId);
  if (readErr) return fail(readErr.message);

  const toDelete = (existing ?? [])
    .filter((e: { size: string }) => !seen.has(e.size))
    .map((e: { id: string }) => e.id);
  if (toDelete.length) {
    const { error } = await supabase.from("product_variants").delete().in("id", toDelete);
    if (error) return fail(error.message);
  }

  if (rows.length) {
    const { error } = await supabase
      .from("product_variants")
      .upsert(rows, { onConflict: "product_id,size" });
    if (error) return fail(error.message);
  }

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "product.variants", "product", productId);

  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

/**
 * Exclui um produto definitivamente. O banco remove em cascata variantes,
 * imagens (linhas), itens de carrinho e movimentos; `order_items.product_id`
 * vira NULL — o histórico de pedidos é preservado (guarda o snapshot do item).
 * Aqui também apagamos os arquivos de imagem do bucket (o cascade não faz isso).
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;

  const supabase = await createClient();

  // Nome (auditoria) e caminhos das imagens (limpeza do Storage) antes de excluir.
  const { data: product } = await supabase
    .from("products")
    .select("name, product_images(storage_path)")
    .eq("id", id)
    .maybeSingle();
  if (!product) return fail("Produto não encontrado.");

  const paths = ((product.product_images as { storage_path: string }[] | null) ?? [])
    .map((i) => i.storage_path)
    .filter(Boolean);

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return fail(error.message);

  // Best-effort: remove os arquivos do bucket (não bloqueia a exclusão).
  if (paths.length) {
    await supabase.storage.from("product-images").remove(paths);
  }

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "product.delete", "product", id, { name: product.name });

  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

export async function uploadProductImage(
  productId: string,
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const g = await guard();
  if (g) return g;

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Arquivo inválido.");
  if (!file.type.startsWith("image/")) return fail("Envie uma imagem.");
  if (file.size > MAX_IMAGE_BYTES) return fail("Imagem acima de 5 MB.");

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${productId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return fail(upErr.message);

  // Primeira imagem vira a principal.
  const { count } = await supabase
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  const { error: insErr } = await supabase.from("product_images").insert({
    product_id: productId,
    storage_path: path,
    alt_text: null,
    is_primary: (count ?? 0) === 0,
  });
  if (insErr) return fail(insErr.message);

  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok({ path });
}

export async function deleteProductImage(
  imageId: string,
  productId: string,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const supabase = await createClient();
  const { data: img } = await supabase
    .from("product_images")
    .select("storage_path")
    .eq("id", imageId)
    .maybeSingle();
  if (img?.storage_path) {
    await supabase.storage.from("product-images").remove([img.storage_path]);
  }
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) return fail(error.message);
  revalidatePath(`/admin/produtos/${productId}`);
  return ok(undefined);
}

export async function setPrimaryImage(imageId: string, productId: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const supabase = await createClient();
  // Desmarca todas antes para não violar o índice único de imagem principal.
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", productId);
  const { error } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId);
  if (error) return fail(error.message);
  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

/**
 * Define a imagem exibida ao passar o mouse (hover) no card da loja.
 * O card mostra a principal em repouso e a segunda (por `position`) no hover.
 * Aqui reordenamos `position` para que a escolhida fique logo após a principal.
 */
export async function setHoverImage(imageId: string, productId: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  const supabase = await createClient();

  const { data: imgs, error: readErr } = await supabase
    .from("product_images")
    .select("id, is_primary, position")
    .eq("product_id", productId);
  if (readErr) return fail(readErr.message);
  if (!imgs?.length) return fail("Nenhuma imagem para reordenar.");

  const chosen = imgs.find((i) => i.id === imageId);
  if (!chosen) return fail("Imagem não encontrada.");
  if (chosen.is_primary) return fail("A imagem principal não pode ser a de hover.");

  // Ordem final: principal(is) → escolhida → demais (mantendo a ordem atual).
  const primaries = imgs.filter((i) => i.is_primary);
  const rest = imgs
    .filter((i) => !i.is_primary && i.id !== imageId)
    .sort((a, b) => a.position - b.position);
  const ordered = [...primaries, chosen, ...rest];

  // Reatribui posições sequenciais (não há índice único em position).
  let pos = 0;
  for (const item of ordered) {
    const { error } = await supabase
      .from("product_images")
      .update({ position: pos })
      .eq("id", item.id);
    if (error) return fail(error.message);
    pos += 1;
  }

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "product.image.hover", "product", productId);

  revalidatePath(`/admin/produtos/${productId}`);
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
): Promise<string> {
  const { data } = await supabase.from("products").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((r: { slug: string }) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
