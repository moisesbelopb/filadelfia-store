"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { CATALOG_TAG } from "@/lib/queries/catalog";
import { createClient } from "@/lib/supabase/server";
import { adjustStockSchema } from "@/lib/validators/admin";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Ajuste manual de estoque: entrada (soma) ou ajuste (soma) com registro em
 * inventory_movements. Baixa/liberação por pedido são feitas pelos triggers.
 */
export async function adjustStock(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");

  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const { productId, type, quantity, reason } = parsed.data;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return fail("Produto não encontrado.");

  const newStock = product.stock + quantity;
  const { error: upErr } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", productId);
  if (upErr) return fail(upErr.message);

  const user = await getCurrentUser();
  const { error: movErr } = await supabase.from("inventory_movements").insert({
    product_id: productId,
    type,
    quantity,
    reason: reason ?? (type === "entrada" ? "Entrada de estoque" : "Ajuste manual"),
    created_by: user?.id ?? null,
  });
  if (movErr) return fail(movErr.message);

  await logAudit(user?.id ?? null, "stock.adjust", "product", productId, {
    type,
    quantity,
    reason,
  });

  revalidatePath("/admin/estoque");
  revalidatePath("/admin/produtos");
  revalidatePath("/");
  revalidateTag(CATALOG_TAG);
  return ok(undefined);
}
