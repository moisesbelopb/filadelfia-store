"use client";

import { cn } from "@/lib/utils";
import { cartCount, useCart } from "@/stores/cart";
import { ClipboardList, Home, ShoppingCart, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Início", icon: Home, exact: true },
  { href: "/carrinho", label: "Carrinho", icon: ShoppingCart, badge: true },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/conta", label: "Conta", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const items = useCart((s) => s.items);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(items) : 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-5xl items-stretch justify-around">
        {links.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          const Icon = l.icon;
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {l.badge && count > 0 && (
                  <span className="absolute right-1/2 top-1 translate-x-3 rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {count}
                  </span>
                )}
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
