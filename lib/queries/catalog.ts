import "server-only";

import { demoCategories, demoProducts } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Category, ProductWithImages } from "@/types/db";
import { unstable_cache } from "next/cache";

const PRODUCT_SELECT =
  "*, product_images(*), product_variants(*), category:categories(id,name,slug)";

/** Filtra pela categoria em UMA query (join), em vez de buscar o id antes. */
const PRODUCT_SELECT_BY_CATEGORY =
  "*, product_images(*), product_variants(*), category:categories!inner(id,name,slug)";

/**
 * Tag de invalidação do catálogo. As actions do admin (produto, variante,
 * imagem, categoria, estoque) chamam revalidateTag(CATALOG_TAG) — o cache cai
 * na hora, então o admin continua vendo a alteração imediatamente na loja.
 */
export const CATALOG_TAG = "catalogo";

/**
 * O catálogo é público e igual para todo mundo: cacheamos o resultado em vez de
 * ir ao banco a cada visita. Usa o client anônimo (sem cookies), o que também
 * libera a página do render dinâmico obrigatório.
 */
export const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) return demoCategories;
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("position");
    return (data as Category[] | null) ?? [];
  },
  ["catalogo:categorias"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

export const getProducts = unstable_cache(
  async (opts?: {
    categorySlug?: string;
    q?: string;
    colorGroup?: string;
  }): Promise<ProductWithImages[]> => {
    if (!isSupabaseConfigured) {
      return filterDemo(demoProducts, opts);
    }
    const supabase = createPublicClient();
    const byCategory = Boolean(opts?.categorySlug) && !opts?.colorGroup;

    let query = supabase
      .from("products")
      .select(byCategory ? PRODUCT_SELECT_BY_CATEGORY : PRODUCT_SELECT)
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });

    if (opts?.colorGroup) {
      // Variações de cor do mesmo item (agrupamento explícito).
      query = query.eq("color_group", opts.colorGroup);
    } else if (opts?.categorySlug) {
      query = query.eq("category.slug", opts.categorySlug);
    }
    if (opts?.q) {
      query = query.ilike("name", `%${opts.q}%`);
    }

    const { data } = await query;
    return (data as unknown as ProductWithImages[] | null) ?? [];
  },
  ["catalogo:produtos"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

export const getFeaturedProducts = unstable_cache(
  async (): Promise<ProductWithImages[]> => {
    if (!isSupabaseConfigured) return demoProducts.filter((p) => p.is_featured);
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("is_active", true)
      .eq("is_featured", true)
      .limit(6);
    return (data as ProductWithImages[] | null) ?? [];
  },
  ["catalogo:destaques"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<ProductWithImages | null> => {
    if (!isSupabaseConfigured) {
      return demoProducts.find((p) => p.slug === slug) ?? null;
    }
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    return (data as ProductWithImages | null) ?? null;
  },
  ["catalogo:produto"],
  { tags: [CATALOG_TAG], revalidate: 3600 },
);

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

  // Reaproveita o catálogo já cacheado em vez de fazer a própria consulta.
  const all = await getProducts();
  const others = all.filter((p) => p.slug !== opts.excludeSlug);
  const sameCat = others.filter((p) => p.category?.slug === opts.categorySlug);
  const rest = others.filter((p) => p.category?.slug !== opts.categorySlug);
  return [...sameCat, ...rest].slice(0, limit);
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
