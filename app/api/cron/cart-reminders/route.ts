import { type CartReminderItem, renderCartReminderEmail } from "@/lib/email/cart-reminder";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// nodemailer precisa do runtime Node (não Edge). Envio pode levar alguns segundos.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const THIRTY_MIN = 30 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 10; // limite por execução (evita estourar o tempo da função)

type ItemRow = {
  cart_id: string;
  quantity: number;
  product: { name: string; price: number } | null;
  variant: { size: string } | null;
};

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
  const provided =
    request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (provided !== secret) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let service: ReturnType<typeof createServiceClient>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    service = createServiceClient();
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "serviço indisponível" }, { status: 500 });
  }

  const now = Date.now();
  const cutoff30 = new Date(now - THIRTY_MIN).toISOString();
  const cutoff7d = new Date(now - SEVEN_DAYS).toISOString();

  // Carrinhos parados há +30min, ainda não lembrados, ativos na última semana.
  const { data: carts, error } = await service
    .from("carts")
    .select("id, user_id")
    .is("reminder_sent_at", null)
    .lt("updated_at", cutoff30)
    .gt("updated_at", cutoff7d)
    .order("updated_at", { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!carts?.length) return NextResponse.json({ checked: 0, sent: 0 });

  // Itens de todos os candidatos numa query só (com nome/preço/tamanho).
  const ids = carts.map((c) => c.id);
  const { data: itemsData } = await service
    .from("cart_items")
    .select("cart_id, quantity, product:products(name, price), variant:product_variants(size)")
    .in("cart_id", ids);

  const byCart = new Map<string, CartReminderItem[]>();
  const subtotal = new Map<string, number>();
  for (const it of (itemsData ?? []) as unknown as ItemRow[]) {
    if (!it.product) continue;
    const line = (Number(it.product.price) || 0) * it.quantity;
    const arr = byCart.get(it.cart_id) ?? [];
    arr.push({
      name: it.product.name,
      size: it.variant?.size ?? null,
      quantity: it.quantity,
      lineTotal: line,
    });
    byCart.set(it.cart_id, arr);
    subtotal.set(it.cart_id, (subtotal.get(it.cart_id) ?? 0) + line);
  }

  let sent = 0;
  for (const cart of carts) {
    const items = byCart.get(cart.id);
    if (!items?.length) continue; // carrinho vazio (já finalizado) → ignora

    const { data: userRes } = await admin.auth.admin.getUserById(cart.user_id);
    const user = userRes?.user;
    if (!user) continue;
    const email = user.email;
    if (!email) continue;
    const name =
      (user.user_metadata?.full_name as string | undefined) || email.split("@")[0] || "cliente";

    const { subject, html } = renderCartReminderEmail(name, items, subtotal.get(cart.id) ?? 0);
    const result = await sendEmail({ to: email, toName: name, subject, html });
    if (result.ok) {
      await service
        .from("carts")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", cart.id);
      sent++;
    }
  }

  return NextResponse.json({ checked: carts.length, sent });
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
