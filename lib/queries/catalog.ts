import "server-only";

import { demoCategories, demoProducts } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Category, ProductWithImages } from "@/types/db";

const PRODUCT_SELECT =
  "*, product_images(*), product_variants(*), category:categories(id,name,slug)";

export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return demoCategories;
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("position");
  return (data as Category[] | null) ?? [];
}

export async function getProducts(opts?: {
  categorySlug?: string;
  q?: string;
  colorGroup?: string;
}): Promise<ProductWithImages[]> {
  if (!isSupabaseConfigured) {
    return filterDemo(demoProducts, opts);
  }
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (opts?.colorGroup) {
    // Variações de cor do mesmo item (agrupamento explícito).
    query = query.eq("color_group", opts.colorGroup);
  } else if (opts?.categorySlug) {
    const { data: cat } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", opts.categorySlug)
      .maybeSingle();
    if (cat) query = query.eq("category_id", cat.id);
  }
  if (opts?.q) {
    query = query.ilike("name", `%${opts.q}%`);
  }

  const { data } = await query;
  return (data as ProductWithImages[] | null) ?? [];
}

export async function getFeaturedProducts(): Promise<ProductWithImages[]> {
  if (!isSupabaseConfigured) return demoProducts.filter((p) => p.is_featured);
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .eq("is_featured", true)
    .limit(6);
  return (data as ProductWithImages[] | null) ?? [];
}

export async function getProductBySlug(slug: string): Promise<ProductWithImages | null> {
  if (!isSupabaseConfigured) {
    return demoProducts.find((p) => p.slug === slug) ?? null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return (data as ProductWithImages | null) ?? null;
}

/**
 * Produtos relacionados para a página de produto ("Você também pode gostar").
 * Prioriza a mesma categoria e completa com os demais, excluindo o atual.
 */
export async function getRelatedProducts(opts: {
  excludeSlug: string;
  categorySlug?: string;
  limit?: number;
}): Promise<ProductWithImages[]> {
  const limit = opts.limit ?? 4;

  const rank = (list: ProductWithImages[]) => {
    const others = list.filter((p) => p.slug !== opts.excludeSlug);
    const sameCat = others.filter((p) => p.category?.slug === opts.categorySlug);
    const rest = others.filter((p) => p.category?.slug !== opts.categorySlug);
    return [...sameCat, ...rest].slice(0, limit);
  };

  if (!isSupabaseConfigured) {
    return rank(demoProducts);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .neq("slug", opts.excludeSlug)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(12);
  return rank((data as ProductWithImages[] | null) ?? []);
}

function filterDemo(
  products: ProductWithImages[],
  opts?: { categorySlug?: string; q?: string; colorGroup?: string },
): ProductWithImages[] {
  let list = products;
  if (opts?.colorGroup) {
    list = list.filter((p) => p.color_group === opts.colorGroup);
  } else if (opts?.categorySlug) {
    list = list.filter((p) => p.category?.slug === opts.categorySlug);
  }
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q));
  }
  return list;
}
