"use server";

import { type ActionResult, fail, ok } from "@/lib/action-result";
import { isSupabaseConfigured } from "@/lib/env";
import { dispatchOrderEmail } from "@/lib/notifications/order-email";
import { DEFAULT_DELIVERY_SETTINGS, findCityFee } from "@/lib/orders/delivery";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { cartItemInput, checkoutSchema } from "@/lib/validators/checkout";
import type { DeliverySettings } from "@/types/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Finaliza o pedido: sincroniza o carrinho ao servidor e chama a RPC
 * transacional create_order (valida estoque, reserva e limpa o carrinho).
 */
export async function placeOrder(
  input: unknown,
  items: unknown,
): Promise<ActionResult<{ orderId: string; orderNumber: number }>> {
  if (!isSupabaseConfigured) {
    return fail("Pedidos indisponíveis: configure o Supabase em .env.local.");
  }

  const parsedInput = checkoutSchema.safeParse(input);
  if (!parsedInput.success) {
    return fail(parsedInput.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const parsedItems = z.array(cartItemInput).min(1).safeParse(items);
  if (!parsedItems.success) return fail("Seu carrinho está vazio.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Faça login para finalizar o pedido.");

  // Garante o carrinho do usuário.
  const { data: cart, error: cartErr } = await supabase
    .from("carts")
    .upsert({ user_id: user.id }, { onConflict: "user_id" })
    .select("id")
    .single();
  if (cartErr || !cart) return fail("Não foi possível preparar o carrinho.");

  // Substitui os itens do servidor pelos itens atuais do cliente.
  await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  const { error: itemsErr } = await supabase.from("cart_items").insert(
    parsedItems.data.map((i) => ({
      cart_id: cart.id,
      product_id: i.productId,
      variant_id: i.variantId,
      quantity: i.quantity,
    })),
  );
  if (itemsErr) return fail("Não foi possível salvar os itens do carrinho.");

  // Cria o pedido (transação no banco).
  const d = parsedInput.data;

  // Taxa de entrega computada no servidor (autoritativa — não confia no cliente).
  let deliveryFee = 0;
  if (d.fulfillment === "entrega") {
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "delivery")
      .maybeSingle();
    const delivery = (setting?.value as DeliverySettings | undefined) ?? DEFAULT_DELIVERY_SETTINGS;
    const cityFee = findCityFee(delivery, d.address?.city ?? "");
    if (!cityFee) return fail("Ainda não entregamos nessa cidade. Escolha retirada na igreja.");
    deliveryFee = cityFee.fee;
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_customer_name: d.customerName,
    p_customer_whatsapp: d.customerWhatsapp,
    p_address: d.fulfillment === "entrega" ? d.address : null,
    p_notes: d.notes ?? null,
    p_payment_method: d.paymentMethod,
    p_fulfillment_type: d.fulfillment,
    p_scheduled_date: d.scheduledDate,
    p_scheduled_window: d.scheduledWindow,
    p_delivery_fee: deliveryFee,
  });
  if (error) return fail(error.message || "Não foi possível criar o pedido.");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fail("Falha ao criar o pedido.");

  // E-mail de "pedido recebido" (best-effort — nunca falha o pedido).
  try {
    await dispatchOrderEmail(row.order_id as string, "order_placed");
  } catch {
    // best-effort
  }

  revalidatePath("/pedidos");
  return ok({
    orderId: row.order_id as string,
    orderNumber: row.order_number as number,
  });
}

/** Cancelamento pelo cliente, permitido apenas enquanto 'solicitado'. */
export async function cancelMyOrder(orderId: string, reason: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Indisponível.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Não autenticado.");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.user_id !== user.id) return fail("Pedido não encontrado.");
  if (order.status !== "solicitado") {
    return fail("Este pedido não pode mais ser cancelado por aqui.");
  }

  // Posse e status já validados: aplica via service client (a RLS reserva
  // UPDATE de orders ao admin). A FSM no banco ainda valida a transição.
  let service: ReturnType<typeof createServiceClient>;
  try {
    service = createServiceClient();
  } catch {
    return fail("Cancelamento indisponível no momento.");
  }
  const { error } = await service
    .from("orders")
    .update({ status: "cancelado", status_reason: reason || "Cancelado pelo cliente" })
    .eq("id", orderId)
    .eq("status", "solicitado");
  if (error) return fail(error.message);

  revalidatePath("/pedidos");
  revalidatePath(`/pedidos/${orderId}`);
  return ok(undefined);
}
