/**
 * Critérios de imagem de produto (compartilhados entre cliente e servidor).
 *
 * Decisão de formato/tamanho (para não pesar no Storage nem na vitrine):
 * - FORMATO gravado: WebP. Para fotos de produto, o WebP é ~25–35% menor que o
 *   JPEG na mesma qualidade e some com o problema dos PNG pesados. O next/image
 *   ainda reotimiza na entrega (AVIF/WebP por dispositivo), então a fonte só
 *   precisa ser leve — o WebP é o melhor equilíbrio tamanho × compatibilidade.
 * - ENTRADA aceita: JPG, PNG ou WebP (o que o lojista costuma ter). Tudo é
 *   convertido para WebP no navegador antes de subir.
 * - DIMENSÃO: no máximo 1600px no lado maior. A maior exibição é ~720px; 1600px
 *   cobre telas retina (2×) com folga e mantém o arquivo entre ~100–300 KB.
 *   Só reduz (nunca amplia), preservando a proporção original.
 * - QUALIDADE: WebP a 0,8 — imperceptível no catálogo, ótima compressão.
 */

/** Lado maior máximo (px) da imagem gravada. */
export const IMAGE_MAX_DIMENSION = 1600;

/** Qualidade do WebP na conversão (0–1). */
export const IMAGE_WEBP_QUALITY = 0.8;

/** Tamanho máximo do arquivo ENVIADO pelo lojista (antes de comprimir). */
export const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024; // 15 MB

/** Tamanho máximo do arquivo GRAVADO no Storage (após compressão). */
export const IMAGE_MAX_STORED_BYTES = 3 * 1024 * 1024; // 3 MB

/** Tipos de arquivo aceitos na entrada. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"] as const;

/** Extensão gravada por content-type (fonte da verdade, não confia no nome). */
export const EXT_BY_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
};

/** Rótulo curto dos formatos aceitos, para a interface. */
export const ACCEPTED_IMAGE_LABEL = "JPG, PNG ou WebP";
