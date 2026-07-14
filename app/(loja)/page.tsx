import { HeroCarousel, type HeroSlide } from "@/components/loja/hero-carousel";
import { ProductCard } from "@/components/loja/product-card";
import { getCategories, getProducts } from "@/lib/queries/catalog";
import { MapPin, PackageSearch, ShieldCheck, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const CATEGORY_TILES = [
  { slug: "feminino", label: "Feminino", image: "/products/modelo_mulher_camisa_bege.webp" },
  { slug: "masculino", label: "Masculino", image: "/products/modelo_homem_camisa_preta.webp" },
  { slug: "infantil", label: "Infantil", image: "/products/lifestyle_criancas_brincando.webp" },
];

const HERO_SLIDES: HeroSlide[] = [
  {
    src: "/products/capa_carrossel_limpa.webp",
    alt: "Casal com as camisetas Preta (costas) e Off-White (frente) da coleção Multiplicação",
    focus: "center 25%",
  },
  {
    src: "/products/casal_negro.webp",
    alt: "Casal com as camisetas Preta e Off-White da coleção Multiplicação",
    focus: "center 22%",
  },
  {
    src: "/products/casal_lifestyle.webp",
    alt: "Casal no parque com as camisetas da coleção Multiplicação",
    focus: "center 25%",
  },
  {
    src: "/products/modelo_mulher_camisa_preta.webp",
    alt: "Modelo feminina com camiseta Preta da coleção Multiplicação",
    focus: "center 20%",
  },
  {
    src: "/products/modelo_homem_bege_sentado.webp",
    alt: "Modelo masculino sentado com camiseta Off-White da coleção Multiplicação",
    focus: "center 30%",
  },
];

const SLOGAN =
  "A camisa oficial do Ano da Multiplicação 2026 foi desenvolvida para representar aquilo que Deus está fazendo entre nós.";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { q, cat } = await searchParams;
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ q, categorySlug: cat }),
  ]);

  const hasFilter = Boolean(q || cat);
  const activeCategory = categories.find((c) => c.slug === cat);

  // Vista filtrada (categoria ou busca): listagem editorial simples.
  if (hasFilter) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <header className="mb-6 flex flex-col gap-1">
          <p className="eyebrow">{q ? "Busca" : "Coleção"}</p>
          <h1 className="section-title">{q ? `“${q}”` : (activeCategory?.name ?? "Produtos")}</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} {products.length === 1 ? "produto" : "produtos"}
          </p>
        </header>
        {products.length === 0 ? <EmptyState hasFilter /> : <ProductGrid products={products} />}
      </div>
    );
  }

  // Home completa.
  return (
    <div className="flex flex-col">
      <Hero />

      <CategoryTiles />

      <section className="mx-auto w-full max-w-[1600px] px-4 py-14">
        <div className="mb-8 flex flex-col gap-1">
          <p className="eyebrow">Coleção Multiplicação</p>
          <h2 className="section-title">Novidades</h2>
        </div>
        {products.length === 0 ? (
          <EmptyState hasFilter={false} />
        ) : (
          <ProductGrid products={products} />
        )}
      </section>

      <Benefits />

      <StoreLocation />
    </div>
  );
}

const STORE_ADDRESS =
  "R. Iracema Mariano Araújo, S/N - Lote 13 - Jardim Veneza, João Pessoa - PB, 58084-546";

function StoreLocation() {
  const query = encodeURIComponent(STORE_ADDRESS);
  return (
    <section className="border-t border-border">
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-2">
        <div className="flex flex-col justify-center gap-4 px-4 py-12 sm:px-8 lg:py-16">
          <p className="eyebrow">Onde estamos</p>
          <h2 className="section-title">Visite a Casa de Filadélfia</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{STORE_ADDRESS}</p>
          <div className="pt-1">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-6 text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <MapPin className="size-4" /> Como chegar
            </a>
          </div>
        </div>
        <div className="relative min-h-[320px] w-full overflow-hidden bg-secondary lg:min-h-[440px]">
          <iframe
            title="Mapa — Casa de Filadélfia"
            src={`https://maps.google.com/maps?q=${query}&z=16&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 h-full w-full border-0 grayscale-[0.2]"
          />
        </div>
      </div>
    </section>
  );
}

function Hero() {
  return (
    <HeroCarousel slides={HERO_SLIDES}>
      <div className="flex max-w-xl flex-col items-start gap-5">
        <p className="text-[0.7rem] font-medium uppercase tracking-[0.3em] text-white/80">
          Ano da Multiplicação · 2026
        </p>
        <h1 className="font-display text-4xl font-bold uppercase leading-[0.95] tracking-[0.02em] text-white sm:text-6xl">
          Multiplicação
        </h1>
        <p className="max-w-md text-sm text-white/85 sm:text-base">{SLOGAN}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/?cat=feminino"
            className="inline-flex h-11 items-center justify-center rounded-md bg-white px-7 text-xs font-semibold uppercase tracking-[0.14em] text-black transition-colors hover:bg-white/90"
          >
            Comprar agora
          </Link>
        </div>
      </div>
    </HeroCarousel>
  );
}

function CategoryTiles() {
  return (
    <section className="mx-auto w-full max-w-[1600px] px-4 py-14">
      <div className="grid gap-4 sm:grid-cols-3">
        {CATEGORY_TILES.map((tile) => (
          <Link
            key={tile.slug}
            href={`/?cat=${tile.slug}`}
            className="group relative block aspect-[3/2] overflow-hidden rounded-md bg-secondary lg:aspect-[16/10]"
          >
            <Image
              src={tile.image}
              alt={tile.label}
              fill
              sizes="(max-width: 640px) 100vw, 45vw"
              quality={90}
              className="object-cover object-[center_20%] transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5">
              <span className="font-display text-lg font-semibold uppercase tracking-[0.12em] text-white">
                {tile.label}
              </span>
              <span className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-white/80 opacity-0 transition-opacity group-hover:opacity-100">
                Ver →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

const BENEFITS = [
  { icon: ShieldCheck, title: "Pague na entrega", text: "Pix, dinheiro ou cartão ao receber." },
  { icon: Truck, title: "Entrega local", text: "Acompanhe o pedido em tempo real." },
];

function Benefits() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 py-12 sm:grid-cols-2">
        {BENEFITS.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.title} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.08em]">{b.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{b.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProductGrid({ products }: { products: Awaited<ReturnType<typeof getProducts>> }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border py-16 text-center">
      <PackageSearch className="size-10 text-muted-foreground" />
      <div>
        <p className="font-medium">
          {hasFilter ? "Nenhum produto encontrado" : "Nenhum produto disponível ainda"}
        </p>
        <p className="text-sm text-muted-foreground">
          {hasFilter
            ? "Tente outra busca ou categoria."
            : "Os produtos aparecerão aqui assim que forem cadastrados."}
        </p>
      </div>
    </div>
  );
}
