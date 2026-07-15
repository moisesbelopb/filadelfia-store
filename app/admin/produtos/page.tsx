import { ProductActiveToggle } from "@/components/admin/product-active-toggle";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { ProductThumb } from "@/components/loja/product-thumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAdminProducts } from "@/lib/queries/admin";
import { cardHighlight, cn, formatBRL } from "@/lib/utils";
import type { ProductWithImages } from "@/types/db";
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

function StockList({ products }: { products: ProductWithImages[] }) {
  const sorted = [...products].sort((a, b) => a.stock - b.stock);
  if (sorted.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((p) => {
        const primary = p.product_images.find((i) => i.is_primary) ?? p.product_images[0];
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3",
              cardHighlight,
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
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
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold tabular-nums">{p.stock}</span>
                {p.stock === 0 ? (
                  <Badge variant="destructive">Zerado</Badge>
                ) : p.stock <= LOW_STOCK ? (
                  <Badge variant="warning">Baixo</Badge>
                ) : null}
              </div>
              <StockAdjuster productId={p.id} productName={p.name} variants={p.product_variants} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
