import type { CompressResult } from "@/lib/image/compress";

/** Limite do comprovante gravado (o mesmo pedido do lojista: 3 MB). */
export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024;

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Extensões (não tipos MIME): o diálogo de arquivo do Windows abre mais rápido
// assim (não precisa resolver MIME → extensão no registro). A validação real
// continua pelo file.type no prepareReceipt e na action.
export const RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf";

/**
 * Prepara o comprovante ANTES do upload (roda no navegador):
 * - até 3 MB: anexa como está (preserva o original).
 * - imagem acima de 3 MB: comprime para WebP reduzindo até caber em 3 MB.
 * - PDF acima de 3 MB: recusa (não dá para compactar PDF no navegador).
 */
export async function prepareReceipt(file: File): Promise<CompressResult> {
  const type = file.type.toLowerCase();
  const isImage = IMAGE_TYPES.includes(type);
  const isPdf = type === "application/pdf";
  if (!isImage && !isPdf) {
    return { ok: false, error: "Envie uma imagem (JPG, PNG, WebP) ou PDF." };
  }
  // Dentro do limite: anexa como está.
  if (file.size <= RECEIPT_MAX_BYTES) return { ok: true, file };

  if (isPdf) {
    return {
      ok: false,
      error: "PDF acima de 3 MB. Envie um PDF menor ou uma imagem (que o sistema compacta).",
    };
  }

  // Imagem acima de 3 MB → comprime até caber.
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    let dim = 1800;
    let quality = 0.82;
    for (let attempt = 0; attempt < 6; attempt++) {
      const blob = await toWebp(bitmap, dim, quality);
      if (blob && blob.size <= RECEIPT_MAX_BYTES) {
        bitmap.close();
        const name = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
        return { ok: true, file: new File([blob], name, { type: "image/webp" }) };
      }
      dim = Math.round(dim * 0.82);
      quality = Math.max(0.4, quality - 0.1);
    }
    bitmap.close();
    return { ok: false, error: "Não foi possível reduzir para 3 MB. Envie uma imagem menor." };
  } catch {
    return { ok: false, error: "Não foi possível processar a imagem." };
  }
}

async function toWebp(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<Blob | null> {
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
}
