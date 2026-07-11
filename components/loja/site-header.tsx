"use client";

import { cn } from "@/lib/utils";
import { cartCount, useCart } from "@/stores/cart";
import { Search, ShoppingCart, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV = [
  { label: "Feminino", slug: "feminino" },
  { label: "Masculino", slug: "masculino" },
  { label: "Infantil", slug: "infantil" },
];

export function SiteHeader() {
  const router = useRouter();
  const params = useSearchParams();
  const activeCat = params.get("cat");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Foca o campo quando a busca abre (acessível, sem autoFocus estático).
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  const count = mounted ? cartCount(items) : 0;

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchOpen(false);
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  }

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        backgroundColor: "var(--header-bg, color-mix(in srgb, var(--background) 85%, transparent))",
        backdropFilter: "blur(var(--header-blur, 12px))",
        WebkitBackdropFilter: "blur(var(--header-blur, 12px))",
      }}
    >
      {/* Barra principal: busca · logo · sacola */}
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3.5">
          <Link
            href="/"
            aria-label="Casa de Filadélfia — início"
            className="flex shrink-0 items-center sm:pl-4 lg:pl-8"
          >
            <Image
              src="/logo.png"
              alt="Casa de Filadélfia"
              width={884}
              height={355}
              priority
              className="h-9 w-auto sm:h-11 dark:brightness-0 dark:invert"
            />
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Buscar"
              aria-expanded={searchOpen}
              className="flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
            >
              {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
            </button>
            <Link
              href="/conta"
              className="hidden size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground sm:flex"
              aria-label="Minha conta / entrar"
            >
              <User className="size-5" />
            </Link>
            <Link
              href="/carrinho"
              className="relative flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={`Carrinho com ${count} ${count === 1 ? "item" : "itens"}`}
            >
              <ShoppingCart className="size-5" />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1 text-[0.62rem] font-semibold text-primary-foreground">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Busca expansível */}
        {searchOpen && (
          <div className="border-t border-border bg-background">
            <form onSubmit={onSearch} className="mx-auto max-w-[1600px] px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="O que você procura?"
                  aria-label="Buscar produtos"
                  className="h-11 w-full rounded-md border border-input bg-card pl-9 pr-4 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Navegação por categoria */}
      <nav aria-label="Categorias" className="border-b border-border bg-background/80">
        <ul className="mx-auto flex max-w-[1600px] items-center justify-center gap-6 px-4 py-2.5 sm:gap-10">
          <NavItem href="/" active={!activeCat && !params.get("q")}>
            Todos
          </NavItem>
          {NAV.map((n) => (
            <NavItem key={n.slug} href={`/?cat=${n.slug}`} active={activeCat === n.slug}>
              {n.label}
            </NavItem>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function NavItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "nav-link relative py-1",
          active &&
            "text-foreground after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:bg-foreground",
        )}
      >
        {children}
      </Link>
    </li>
  );
}
