import { CategoriesManager } from "@/components/admin/categories-manager";
import { listCategoriesWithCounts } from "@/lib/queries/admin";

export default async function CategoriasPage() {
  const categories = await listCategoriesWithCounts();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Produtos</p>
        <h1 className="mt-1 text-xl font-semibold">Categorias</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie, renomeie, reordene e ative/oculte as categorias. Categorias ocultas somem da loja;
          os produtos continuam, apenas sem categoria.
        </p>
      </div>

      <CategoriesManager categories={categories} />
    </div>
  );
}
