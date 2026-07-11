import { ProductForm } from "@/components/admin/product-form";
import { listCategories } from "@/lib/queries/admin";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function NovoProdutoPage() {
  const categories = await listCategories();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/produtos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Produtos
      </Link>
      <h1 className="text-xl font-semibold">Novo produto</h1>
      <p className="-mt-2 text-sm text-muted-foreground">
        Crie o produto e, na tela de edição, defina os tamanhos/estoque e adicione as fotos.
      </p>
      <ProductForm categories={categories} />
    </div>
  );
}
