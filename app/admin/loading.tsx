import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto do painel — dá retorno imediato ao navegar entre os menus. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => `card-${i}`).map((key) => (
          <Skeleton key={key} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => `row-${i}`).map((key) => (
          <Skeleton key={key} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
