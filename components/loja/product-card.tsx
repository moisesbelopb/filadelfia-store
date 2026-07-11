import { ProductQuickAdd } from "@/components/loja/product-quick-add";
import { ProductThumb } from "@/components/loja/product-thumb";
import { formatBRL } from "@/lib/utils";
import type { ProductWithImages } from "@/types/db";
import Link from "next/link";

export function ProductCard({ product }: { product: ProductWithImages }) {
  const images = [...product.product_images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return a.position - b.position;
  });
  const primary = images[0];
  const secondary = images[1];
  const soldOut = product.product_variants.length
    ? product.product_variants.every((v) => v.stock <= 0)
    : product.stock <= 0;

  // Rótulo de tamanhos (primeiro..último) para dar contexto no card.
  const sizes = [...product.product_variants].sort((a, b) => a.position - b.position);
  const firstSize = sizes[0]?.size;
  const lastSize = sizes[sizes.length - 1]?.size;
  const sizeLabel = sizes.length > 1 ? `${firstSize}–${lastSize}` : firstSize;

  // As fotos são landscape 3:2 recortadas num card retrato 4:5 (object-cover
  // corta pela ALTURA). Por isso pedimos uma fonte ~1,9× a largura da coluna
  // (2 → 3 → 4 colunas), senão o Next serve uma versão baixa e a imagem borra.
  const cardSizes = "(max-width: 640px) 100vw, (max-width: 1024px) 62vw, 47vw";

  return (
    <div className="group flex flex-col">
      <Link
        href={`/produtos/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden rounded-md bg-secondary"
      >
        <div className="absolute inset-0 transition-opacity duration-500 group-hover:opacity-0">
          <ProductThumb
            name={product.name}
            path={primary?.storage_path}
            sizes={cardSizes}
            className="transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>
        {secondary && (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            <ProductThumb name={product.name} path={secondary.storage_path} sizes={cardSizes} />
          </div>
        )}

        {product.is_featured && !soldOut && (
          <span className="absolute left-3 top-3 bg-primary px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground">
            Destaque
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[1px]">
            <span className="border border-foreground/30 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em]">
              Esgotado
            </span>
          </div>
        )}
      </Link>

      <div className="mt-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {product.color_hex && (
              <span
                className="size-3.5 shrink-0 rounded-full border border-black/15"
                style={{ backgroundColor: product.color_hex }}
                aria-hidden
              />
            )}
            {product.color_name && (
              <span className="truncate text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">
                {product.color_name}
              </span>
            )}
          </div>
          {sizeLabel && (
            <span className="shrink-0 text-[0.68rem] uppercase tracking-[0.1em] text-muted-foreground">
              {sizeLabel}
            </span>
          )}
        </div>

        <Link href={`/produtos/${product.slug}`}>
          <h3 className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-foreground/70">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{formatBRL(product.price)}</span>
          {!soldOut && <ProductQuickAdd product={product} />}
        </div>
      </div>
    </div>
  );
}
