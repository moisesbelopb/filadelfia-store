import { ProductActiveToggle } from "@/components/admin/product-active-toggle";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { ProductThumb } from "@/components/loja/product-thumb";
import { Button } from "@/components/ui/button";
import { listAdminProducts } from "@/lib/queries/admin";
import { cardHighlight, cn, formatBRL } from "@/lib/utils";
import type { ProductVariant, ProductWithImages } from "@/types/db";
import { Plus } from "lucide-react";
import Link from "next/link";

const LOW_STOCK = 5;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab === "estoque" ? "estoque" : "produtos";
  const products = await listAdminProducts();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{active === "estoque" ? "Estoque" : "Produtos"}</h1>
        {active === "produtos" && (
          <Button asChild size="sm">
            <Link href="/admin/produtos/novo">
              <Plus /> Novo produto
            </Link>
          </Button>
        )}
      </div>

      {/* Abas: alterna entre a lista de produtos e a visão de estoque. */}
      <div className="flex gap-1 border-b border-border">
        <TabLink href="/admin/produtos" active={active === "produtos"}>
          Produtos
        </TabLink>
        <TabLink href="/admin/produtos?tab=estoque" active={active === "estoque"}>
          Estoque
        </TabLink>
      </div>

      {active === "estoque" ? (
        <StockList products={products} />
      ) : (
        <ProductsList products={products} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function ProductsList({ products }: { products: ProductWithImages[] }) {
  if (products.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {products.map((p) => {
        const primary = p.product_images.find((i) => i.is_primary) ?? p.product_images[0];
        return (
          <li key={p.id}>
            <Link
              href={`/admin/produtos/${p.id}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-border bg-card p-3",
                cardHighlight,
              )}
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border">
                <ProductThumb name={p.name} path={primary?.storage_path} sizes="96px" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.category?.name ?? "Sem categoria"} · {formatBRL(p.price)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <ProductActiveToggle id={p.id} isActive={p.is_active} />
                <span className="text-xs text-muted-foreground">{p.stock} un.</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Conta quantas variantes do produto estão em falta (0) e em estoque mínimo (1..5). */
function stockIssues(variants: ProductVariant[]): { out: number; low: number } {
  return variants.reduce(
    (acc, v) => {
      if (v.stock === 0) acc.out += 1;
      else if (v.stock <= LOW_STOCK) acc.low += 1;
      return acc;
    },
    { out: 0, low: 0 },
  );
}

/** Chips de tamanho coloridos: vermelho = em falta, laranja = estoque mínimo. */
function SizeChips({ variants }: { variants: ProductVariant[] }) {
  const sorted = [...variants].sort((a, b) => a.position - b.position);
  if (sorted.length === 0) {
    return <span className="text-xs text-muted-foreground">Sem tamanhos</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {sorted.map((v) => {
        const out = v.stock === 0;
        const low = v.stock > 0 && v.stock <= LOW_STOCK;
        return (
          <span
            key={v.id}
            title={`Tamanho ${v.size}: ${v.stock} ${v.stock === 1 ? "unidade" : "unidades"}`}
            className={cn(
              "inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-1.5 py-1 text-xs font-semibold uppercase tabular-nums",
              out && "border-destructive/40 bg-destructive/10 text-destructive",
              low && "border-warning/40 bg-warning/10 text-warning",
              !out && !low && "border-border bg-secondary text-muted-foreground",
            )}
          >
            {v.size}
          </span>
        );
      })}
    </div>
  );
}

function StockList({ products }: { products: ProductWithImages[] }) {
  // Mais críticos primeiro: mais tamanhos em falta, depois menor estoque total.
  const sorted = [...products].sort((a, b) => {
    const ia = stockIssues(a.product_variants);
    const ib = stockIssues(b.product_variants);
    if (ib.out !== ia.out) return ib.out - ia.out;
    if (ib.low !== ia.low) return ib.low - ia.low;
    return a.stock - b.stock;
  });
  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {/* Legenda das cores dos tamanhos. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-destructive/60" /> Em falta
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-warning/70" /> Estoque mínimo (até {LOW_STOCK})
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {sorted.map((p) => {
          const primary = p.product_images.find((i) => i.is_primary) ?? p.product_images[0];
          return (
            <li
              key={p.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4",
                cardHighlight,
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg border">
                  <ProductThumb name={p.name} path={primary?.storage_path} sizes="96px" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.category?.name ?? "Sem categoria"}
                  </p>
                </div>
              </div>

              <SizeChips variants={p.product_variants} />

              <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                <span className="text-sm text-muted-foreground">
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    {p.stock}
                  </span>{" "}
                  un.
                </span>
                <StockAdjuster
                  productId={p.id}
                  productName={p.name}
                  variants={p.product_variants}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
