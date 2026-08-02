"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { CartLine } from "@/stores/cart";
import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable(),
  quantity: z.coerce.number().int().min(1).max(99),
});
const itemsSchema = z.array(itemSchema).max(100);

/**
 * Salva o carrinho do cliente LOGADO no servidor. Habilita o lembrete de
 * carrinho abandonado e o carrinho entre dispositivos. Visitante não logado é
 * ignorado (o carrinho dele vive só no navegador). Substitui os itens do
 * servidor pelos atuais e reinicia a janela de abandono.
 */
export async function syncCart(items: unknown): Promise<void> {
  if (!isSupabaseConfigured) return;
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: cart } = await supabase
    .from("carts")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (!cart) return;

  await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  if (parsed.data.length) {
    await supabase.from("cart_items").insert(
      parsed.data.map((i) => ({
        cart_id: cart.id,
        product_id: i.productId,
        variant_id: i.variantId,
        quantity: i.quantity,
      })),
    );
  }
  // Toda mudança reinicia a janela de abandono. Tolerante: se a coluna ainda
  // não existir (SQL não rodado), o supabase-js só retorna erro e seguimos.
  await supabase.from("carts").update({ reminder_sent_at: null }).eq("id", cart.id);
}

type CartItemRow = {
  quantity: number;
  product_id: string;
  variant_id: string | null;
  product: {
    name: string;
    slug: string;
    price: number;
    color_name: string | null;
    product_images: { storage_path: string; is_primary: boolean; position: number }[];
  } | null;
  variant: { size: string; stock: number } | null;
};

/**
 * Carrega o carrinho salvo do cliente logado (para hidratar o store ao entrar
 * ou em outro dispositivo). Retorna linhas prontas para o carrinho do cliente.
 */
export async function loadCart(): Promise<CartLine[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!cart) return [];

  const { data } = await supabase
    .from("cart_items")
    .select(
      "quantity, product_id, variant_id, product:products(name, slug, price, color_name, product_images(storage_path, is_primary, position)), variant:product_variants(size, stock)",
    )
    .eq("cart_id", cart.id);

  const rows = (data ?? []) as unknown as CartItemRow[];
  return rows
    .filter((r) => r.product !== null && r.variant !== null && r.variant_id !== null)
    .map((r) => {
      const product = r.product as NonNullable<CartItemRow["product"]>;
      const variant = r.variant as NonNullable<CartItemRow["variant"]>;
      const imgs = product.product_images ?? [];
      const primary =
        imgs.find((i) => i.is_primary) ?? [...imgs].sort((a, b) => a.position - b.position)[0];
      return {
        variantId: r.variant_id as string,
        productId: r.product_id,
        slug: product.slug,
        name: product.name,
        size: variant.size,
        price: Number(product.price),
        quantity: r.quantity,
        image: primary?.storage_path ?? null,
        stock: variant.stock,
        colorName: product.color_name,
      } satisfies CartLine;
    });
}
