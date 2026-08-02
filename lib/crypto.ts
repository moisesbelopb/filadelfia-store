import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifra simétrica para segredos guardados no banco (ex.: senha de app do Gmail).
 * Chave AES-256 derivada da SUPABASE_SERVICE_ROLE_KEY (segredo server-only) —
 * não exige env nova. Formato: base64( iv[12] | tag[16] | ciphertext ).
 */
function key(): Buffer {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!secret) throw new Error("Sem SUPABASE_SERVICE_ROLE_KEY para cifrar/decifrar.");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
