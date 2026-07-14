import { OrderCard } from "@/components/loja/order-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getMyOrders } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/db";
import { ClipboardList, LogIn, PackageSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Meus pedidos" };

/** Filtros por situação — metade dos acessos é só para acompanhar (Baymard). */
const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "andamento", label: "Em andamento" },
  { key: "concluidos", label: "Concluídos" },
  { key: "cancelados", label: "Cancelados" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const GROUPS: Record<Exclude<FilterKey, "todos">, OrderStatus[]> = {
  andamento: ["solicitado", "aceito", "em_separacao", "saiu_entrega"],
  concluidos: ["entregue"],
  cancelados: ["recusado", "cancelado"],
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
        <ClipboardList className="size-10 text-muted-foreground" />
        <p className="font-medium">Entre para ver seus pedidos</p>
        <p className="text-sm text-muted-foreground">
          Acompanhe o status, a entrega e o pagamento de cada pedido.
        </p>
        <Button asChild className="w-full">
          <Link href="/login?redirect=/pedidos">
            <LogIn /> Entrar
          </Link>
        </Button>
      </div>
    );
  }

  const { filtro } = await searchParams;
  const active: FilterKey = FILTERS.some((f) => f.key === filtro)
    ? (filtro as FilterKey)
    : "todos";

  const orders = await getMyOrders();

  if (orders.length === 0) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-16 text-center">
        <ClipboardList className="size-10 text-muted-foreground" />
        <p className="font-medium">Você ainda não fez pedidos</p>
        <p className="text-sm text-muted-foreground">
          Quando fizer, eles aparecem aqui com o status e a forma de pagamento.
        </p>
        <Button asChild className="mt-1">
          <Link href="/">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  const counts = {
    todos: orders.length,
    andamento: orders.filter((o) => GROUPS.andamento.includes(o.status)).length,
    concluidos: orders.filter((o) => GROUPS.concluidos.includes(o.status)).length,
    cancelados: orders.filter((o) => GROUPS.cancelados.includes(o.status)).length,
  } satisfies Record<FilterKey, number>;

  const visible =
    active === "todos" ? orders : orders.filter((o) => GROUPS[active].includes(o.status));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <div>
        <h1 className="section-title">Meus pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhe o status, o agendamento e a forma de pagamento de cada pedido.
        </p>
      </div>

      {/* Filtros por situação */}
      <nav
        aria-label="Filtrar pedidos"
        className="flex gap-1 overflow-x-auto border-b border-border pb-px [&::-webkit-scrollbar]:hidden"
      >
        {FILTERS.map((f) => {
          const isActive = f.key === active;
          return (
            <Link
              key={f.key}
              href={f.key === "todos" ? "/pedidos" : `/pedidos?filtro=${f.key}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1.5 text-xs text-muted-foreground">({counts[f.key]})</span>
            </Link>
          );
        })}
      </nav>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
          <PackageSearch className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum pedido nesta situação.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/pedidos">Ver todos</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
