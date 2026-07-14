import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto da vitrine. Sem ele, o clique num link não mostrava NADA até o
 * servidor terminar de responder — a navegação parecia travada. Com o boundary,
 * o Next envia este shell na hora e faz streaming do conteúdo quando resolve.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <div className="mb-8 flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => `sk-${i}`).map((key) => (
          <div key={key} className="flex flex-col gap-3">
            <Skeleton className="aspect-[3/4] w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
