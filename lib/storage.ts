import { SUPABASE_URL } from "@/lib/env";

const BUCKET = "product-images";

/** Monta a URL pública de uma imagem de produto a partir do storage_path. */
export function productImageUrl(path?: string | null): string | null {
  if (!path) return null;
  // URLs absolutas e caminhos locais em /public (ex.: /products/foo.png) passam direto.
  if (path.startsWith("http") || path.startsWith("/")) return path;
  if (!SUPABASE_URL) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
