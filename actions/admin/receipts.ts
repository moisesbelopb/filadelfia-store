"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { getCurrentUser, isAdminUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const BUCKET = "comprovantes";
const MAX_BYTES = 3 * 1024 * 1024;
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "application/pdf": "pdf",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(): Promise<{ ok: false; error: string } | null> {
  if (!isSupabaseConfigured) return fail("Configure o Supabase.");
  if (!(await isAdminUser())) return fail("Acesso negado.");
  return null;
}

/** Anexa um comprovante de pagamento ao pedido (arquivo já validado/comprimido no cliente). */
export async function uploadOrderReceipt(
  orderId: string,
  formData: FormData,
): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  if (!UUID.test(orderId)) return fail("Pedido inválido.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Selecione um arquivo.");
  const type = file.type.toLowerCase();
  const ext = EXT[type];
  if (!ext) return fail("Formato não aceito. Envie imagem (JPG/PNG/WebP) ou PDF.");
  if (file.size > MAX_BYTES) return fail("Arquivo acima de 3 MB.");

  const service = createServiceClient();
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await service.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.receipt.add", "order", orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok(undefined);
}

/** Remove um comprovante do pedido. */
export async function deleteOrderReceipt(orderId: string, fileName: string): Promise<ActionResult> {
  const g = await guard();
  if (g) return g;
  if (!UUID.test(orderId)) return fail("Pedido inválido.");
  // Evita path traversal: só um nome simples de arquivo.
  if (!/^[\w.-]+$/.test(fileName)) return fail("Nome de arquivo inválido.");

  const service = createServiceClient();
  const { error } = await service.storage.from(BUCKET).remove([`${orderId}/${fileName}`]);
  if (error) return fail(error.message);

  const user = await getCurrentUser();
  await logAudit(user?.id ?? null, "order.receipt.remove", "order", orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  return ok(undefined);
}
