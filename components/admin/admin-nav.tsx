"use client";

import { cn } from "@/lib/utils";
import {
  Bike,
  Contact,
  FileClock,
  LayoutDashboard,
  MessageSquare,
  Package,
  Palette,
  ScrollText,
  Tags,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/pedidos", label: "Pedidos", icon: ScrollText },
  { href: "/admin/entregas", label: "Entregas", icon: Bike },
  { href: "/admin/produtos", label: "Produtos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Tags },
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/usuarios", label: "Usuários", icon: Users },
  { href: "/admin/configuracoes/whatsapp", label: "Comunicação", icon: MessageSquare },
  { href: "/admin/configuracoes/entrega", label: "Config. entrega", icon: Truck },
  { href: "/admin/configuracoes/visual", label: "Visual", icon: Palette },
  { href: "/admin/conta", label: "Minha conta", icon: UserCog },
];

/** `showLogs` só é true para o dono do sistema (logs de acesso). */
export function AdminNav({ showLogs = false }: { showLogs?: boolean }) {
  const pathname = usePathname();
  const navItems = showLogs
    ? [...items, { href: "/admin/logs", label: "Logs de acesso", icon: FileClock }]
    : items;
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
      {navItems.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
