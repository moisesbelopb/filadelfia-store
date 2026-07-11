import { BackButton } from "@/components/loja/back-button";
import { ProductBuy } from "@/components/loja/product-buy";
import { ProductCard } from "@/components/loja/product-card";
import { ProductGallery } from "@/components/loja/product-gallery";
import { WhatsappShare } from "@/components/loja/whatsapp-share";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE_URL } from "@/lib/env";
import { getProductBySlug, getProducts, getRelatedProducts } from "@/lib/queries/catalog";
import { productImageUrl } from "@/lib/storage";
import { cn, formatBRL } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/** Foto principal do produto como URL absoluta (para preview/SEO). */
function primaryImageUrl(product: Awaited<ReturnType<typeof getProductBySlug>>): string {
  const primary = [...(product?.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
  )[0];
  const path = productImageUrl(primary?.storage_path);
  if (!path) return `${SITE_URL}/logo.png`;
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Produto não encontrado" };

  const image = primaryImageUrl(product);
  const description =
    product.description_short ?? `${formatBRL(product.price)} · Casa de Filadélfia`;
  const url = `${SITE_URL}/produtos/${product.slug}`;

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
      description: `${formatBRL(product.price)} · ${description}`,
      url,
      type: "website",
      images: [{ url: image, width: 1200, height: 1200, alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [image],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const catSlug = product.category?.slug;
  // Variações de cor: preferem o grupo de cor explícito; senão, a categoria.
  const siblingsQuery = product.color_group
    ? getProducts({ colorGroup: product.color_group })
    : catSlug
      ? getProducts({ categorySlug: catSlug })
      : Promise.resolve([product]);
  const [siblings, related] = await Promise.all([
    siblingsQuery,
    getRelatedProducts({ excludeSlug: product.slug, categorySlug: catSlug, limit: 4 }),
  ]);
  const colorOptions = siblings
    .filter((p) => p.color_name)
    .map((p) => ({
      slug: p.slug,
      name: p.color_name as string,
      hex: p.color_hex,
      active: p.id === product.id,
    }));

  const images = [...product.product_images]
    .sort((a, b) => {
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.position - b.position;
    })
    .map((i) => ({ path: i.storage_path, alt: i.alt_text }));

  const variants = [...product.product_variants]
    .sort((a, b) => a.position - b.position)
    .map((v) => ({ id: v.id, size: v.size, stock: v.stock }));

  const primaryImage = images[0]?.path ?? null;

  const url = `${SITE_URL}/produtos/${product.slug}`;
  const shareText = `${product.name} — ${formatBRL(product.price)}\n${url}`;
  const inStock = variants.some((v) => v.stock > 0);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: [primaryImageUrl(product)],
    description: product.description_short ?? product.description_long ?? undefined,
    ...(product.category ? { category: product.category.name } : {}),
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: product.price,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <BackButton fallbackHref={catSlug ? `/?cat=${catSlug}` : "/"} />

        <div className="grid gap-8 lg:grid-cols-2">
          <ProductGallery name={product.name} images={images} />

          <div className="flex flex-col gap-6 lg:pt-2">
            <div className="flex flex-col gap-3">
              {product.category && <p className="eyebrow">{product.category.name}</p>}
              <h1 className="font-display text-2xl font-semibold uppercase tracking-[0.02em] sm:text-3xl">
                {product.name}
              </h1>
              <p className="text-2xl font-semibold">{formatBRL(product.price)}</p>
              <p className="text-xs text-muted-foreground">
                Pagamento na entrega · Pix, dinheiro ou cartão
              </p>
            </div>

            {colorOptions.length > 1 && (
              <div className="flex flex-col gap-2.5">
                <span className="eyebrow">Cor — {product.color_name}</span>
                <div className="flex gap-2">
                  {colorOptions.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/produtos/${c.slug}`}
                      aria-label={`Cor ${c.name}`}
                      aria-current={c.active}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full border transition",
                        c.active ? "border-foreground" : "border-border hover:border-foreground/60",
                      )}
                    >
                      <span
                        className="size-7 rounded-full border border-black/10"
                        style={{ backgroundColor: c.hex ?? "#cccccc" }}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <ProductBuy
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                image: primaryImage,
                colorName: product.color_name,
              }}
              variants={variants}
            />

            <WhatsappShare text={shareText} label="Compartilhar no WhatsApp" className="w-fit" />

            {product.description_long && (
              <div className="border-t border-border pt-5">
                <p className="eyebrow mb-2">Detalhes</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                  {product.description_long}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="mb-8 flex flex-col gap-1">
              <p className="eyebrow">Coleção Multiplicação</p>
              <h2 className="section-title">Você também pode gostar</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
