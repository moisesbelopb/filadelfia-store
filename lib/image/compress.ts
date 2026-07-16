import {
  ACCEPTED_IMAGE_TYPES,
  IMAGE_MAX_DIMENSION,
  IMAGE_MAX_INPUT_BYTES,
  IMAGE_WEBP_QUALITY,
} from "@/lib/image/criteria";

export type CompressResult = { ok: true; file: File } | { ok: false; error: string };

/**
 * Prepara a imagem do produto ANTES do upload (roda no navegador): valida o
 * tipo/tamanho, reduz para no máximo IMAGE_MAX_DIMENSION no lado maior e
 * converte para WebP. Assim o arquivo gravado no Storage já sobe leve.
 *
 * Se o navegador não conseguir processar (formato exótico, API indisponível),
 * devolve o arquivo original — o servidor ainda valida tipo e tamanho.
 */
export async function compressProductImage(file: File): Promise<CompressResult> {
  const type = file.type.toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Formato não aceito. Envie JPG, PNG ou WebP." };
  }
  if (file.size > IMAGE_MAX_INPUT_BYTES) {
    return { ok: false, error: "Arquivo muito grande (máx. 15 MB)." };
  }

  try {
    // Decodifica respeitando a orientação EXIF (fotos de celular não deitam).
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", IMAGE_WEBP_QUALITY),
    );
    if (!blob) throw new Error("conversão WebP falhou");

    const name = `${file.name.replace(/\.[^.]+$/, "")}.webp`;
    return { ok: true, file: new File([blob], name, { type: "image/webp" }) };
  } catch {
    // Fallback seguro: sobe o original (dentro dos limites já validados acima).
    return { ok: true, file };
  }
}
