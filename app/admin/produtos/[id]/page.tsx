import { ProductDelete } from "@/components/admin/product-delete";
import { ProductForm } from "@/components/admin/product-form";
import { ProductImagesManager } from "@/components/admin/product-images-manager";
import { ProductVariantsManager } from "@/components/admin/product-variants-manager";
import { getAdminProduct, listCategories } from "@/lib/queries/admin";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getAdminProduct(id), listCategories()]);
  if (!product) notFound();

  const images = [...product.product_images].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
  );

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/produtos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Produtos
      </Link>
      <h1 className="text-xl font-semibold">{product.name}</h1>

      <ProductForm categories={categories} product={product} />
      <ProductVariantsManager productId={product.id} variants={product.product_variants ?? []} />
      <ProductImagesManager productId={product.id} images={images} productName={product.name} />
      <ProductDelete productId={product.id} productName={product.name} />
    </div>
  );
}
