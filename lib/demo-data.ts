import type { Category, ProductImage, ProductVariant, ProductWithImages } from "@/types/db";

/**
 * Dados de demonstração usados enquanto o Supabase não está configurado,
 * para a loja aparecer viva em `pnpm dev`. Espelham supabase/seed.sql.
 *
 * Catálogo: coleção "Multiplicação" (pães + peixes) em 2 cores — Off-White e
 * Preta — para Feminino, Masculino e Infantil. Estoque controlado por tamanho.
 */
const now = "2026-01-01T00:00:00.000Z";

// Tamanhos por público.
export const ADULT_SIZES = ["PP", "P", "M", "G", "GG", "XGG", "EXGG"] as const;
export const KIDS_SIZES = ["2", "4", "6", "8", "10"] as const;

// Cores da coleção.
const OFF_WHITE = { name: "Off-White", hex: "#E7E0D0" };
const PRETA = { name: "Preta", hex: "#161616" };

// Preços.
const PRICE_ADULT = 49.9;
const PRICE_KIDS = 39.9;

const feminino: Category = {
  id: "cat-feminino",
  name: "Feminino",
  slug: "feminino",
  position: 1,
  is_active: true,
  created_at: now,
};
const masculino: Category = {
  id: "cat-masculino",
  name: "Masculino",
  slug: "masculino",
  position: 2,
  is_active: true,
  created_at: now,
};
const infantil: Category = {
  id: "cat-infantil",
  name: "Infantil",
  slug: "infantil",
  position: 3,
  is_active: true,
  created_at: now,
};

export const demoCategories: Category[] = [feminino, masculino, infantil];

const DESCRIPTION_LONG =
  "Camiseta oversized da coleção Multiplicação. A estampa traduz o milagre dos " +
  "pães e peixes: 5 pães + 2 peixes = MULTIPLICAÇÃO. Malha 100% algodão penteado " +
  "fio 30.1, gola careca reforçada e caimento amplo. Estampa em silk de alta durabilidade.";

interface ProductSpec {
  id: string;
  slug: string;
  color: { name: string; hex: string };
  category: Category;
  price: number;
  sizes: readonly string[];
  /** Estoque por tamanho, na ordem de `sizes`. 0 = esgotado. */
  stockBySize: number[];
  images: { file: string; alt: string }[];
  is_featured: boolean;
}

function buildProduct(spec: ProductSpec): ProductWithImages {
  const audience = spec.category.name;
  const name = `Camiseta Multiplicação ${spec.color.name} · ${audience}`;

  const product_images: ProductImage[] = spec.images.map((img, i) => ({
    id: `${spec.id}-img-${i}`,
    product_id: spec.id,
    storage_path: `/products/${img.file}`,
    alt_text: img.alt,
    position: i,
    is_primary: i === 0,
    created_at: now,
  }));

  const product_variants: ProductVariant[] = spec.sizes.map((size, i) => ({
    id: `${spec.id}-var-${size}`,
    product_id: spec.id,
    size,
    stock: spec.stockBySize[i] ?? 0,
    position: i,
    created_at: now,
  }));

  const stock = product_variants.reduce((acc, v) => acc + v.stock, 0);

  return {
    id: spec.id,
    category_id: spec.category.id,
    category: { id: spec.category.id, name: spec.category.name, slug: spec.category.slug },
    name,
    slug: spec.slug,
    description_short: `Camiseta oversized ${spec.color.name} · Coleção Multiplicação`,
    description_long: DESCRIPTION_LONG,
    price: spec.price,
    stock,
    color_name: spec.color.name,
    color_hex: spec.color.hex,
    color_group: `camiseta-${spec.category.slug}`,
    is_active: true,
    is_featured: spec.is_featured,
    visual: null,
    product_images,
    product_variants,
    created_at: now,
    updated_at: now,
  };
}

export const demoProducts: ProductWithImages[] = [
  buildProduct({
    id: "p-fem-offwhite",
    slug: "camiseta-multiplicacao-off-white-feminino",
    color: OFF_WHITE,
    category: feminino,
    price: PRICE_ADULT,
    sizes: ADULT_SIZES,
    stockBySize: [4, 8, 10, 7, 5, 2, 0],
    is_featured: true,
    images: [
      { file: "frente_mulher_inicial_bege_larga.png", alt: "Camiseta Off-White feminina, frente" },
      { file: "costas_mulher_inicial_bege.png", alt: "Camiseta Off-White feminina, costas" },
      { file: "modelo_mulher_camisa_bege.png", alt: "Modelo feminina com camiseta Off-White" },
      {
        file: "costas_mulher_negra_bege.png",
        alt: "Camiseta Off-White feminina, costas (estampa)",
      },
    ],
  }),
  buildProduct({
    id: "p-fem-preta",
    slug: "camiseta-multiplicacao-preta-feminino",
    color: PRETA,
    category: feminino,
    price: PRICE_ADULT,
    sizes: ADULT_SIZES,
    stockBySize: [6, 9, 12, 8, 4, 3, 1],
    is_featured: true,
    images: [
      { file: "frente_mulher_inicial_preto_larga.png", alt: "Camiseta Preta feminina, frente" },
      { file: "costas_mulher_inicial_preto.png", alt: "Camiseta Preta feminina, costas" },
      { file: "modelo_mulher_camisa_preta.png", alt: "Modelo feminina com camiseta Preta" },
      { file: "frente_mulher_negra_preta.png", alt: "Camiseta Preta feminina, detalhe" },
    ],
  }),
  buildProduct({
    id: "p-masc-offwhite",
    slug: "camiseta-multiplicacao-off-white-masculino",
    color: OFF_WHITE,
    category: masculino,
    price: PRICE_ADULT,
    sizes: ADULT_SIZES,
    stockBySize: [3, 7, 11, 9, 6, 4, 2],
    is_featured: true,
    images: [
      { file: "frente_homem_inicial_bege_larga.png", alt: "Camiseta Off-White masculina, frente" },
      { file: "costas_homem_inicial_bege.png", alt: "Camiseta Off-White masculina, costas" },
      { file: "modelo_homem_camisa_bege.png", alt: "Modelo masculino com camiseta Off-White" },
      { file: "modelo_homem_bege_sentado.png", alt: "Modelo masculino sentado, lifestyle" },
    ],
  }),
  buildProduct({
    id: "p-masc-preta",
    slug: "camiseta-multiplicacao-preta-masculino",
    color: PRETA,
    category: masculino,
    price: PRICE_ADULT,
    sizes: ADULT_SIZES,
    stockBySize: [0, 6, 10, 12, 7, 5, 3],
    is_featured: false,
    images: [
      { file: "frente_homem_inicial_preto_larga.png", alt: "Camiseta Preta masculina, frente" },
      { file: "costas_homem_inicial_preto.png", alt: "Camiseta Preta masculina, costas" },
      { file: "modelo_homem_camisa_preta.png", alt: "Modelo masculino com camiseta Preta" },
      { file: "frente_homem_inicial_preto_final.png", alt: "Camiseta Preta masculina, detalhe" },
    ],
  }),
  buildProduct({
    id: "p-inf-offwhite",
    slug: "camiseta-multiplicacao-off-white-infantil",
    color: OFF_WHITE,
    category: infantil,
    price: PRICE_KIDS,
    sizes: KIDS_SIZES,
    stockBySize: [5, 6, 4, 3, 2],
    is_featured: false,
    images: [
      { file: "frente_menino_bege_v2.png", alt: "Criança com camiseta Off-White, frente" },
      { file: "costas_menino_bege_v2.png", alt: "Camiseta Off-White infantil, costas" },
    ],
  }),
  buildProduct({
    id: "p-inf-preta",
    slug: "camiseta-multiplicacao-preta-infantil",
    color: PRETA,
    category: infantil,
    price: PRICE_KIDS,
    sizes: KIDS_SIZES,
    stockBySize: [6, 5, 5, 4, 3],
    is_featured: true,
    images: [
      { file: "frente_menina_preta_v2.png", alt: "Criança com camiseta Preta, frente" },
      { file: "costas_menina_preta_v2.png", alt: "Camiseta Preta infantil, costas" },
    ],
  }),
];
