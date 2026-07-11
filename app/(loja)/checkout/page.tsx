import { CheckoutForm } from "@/components/loja/checkout-form";
import { getProfile } from "@/lib/auth";
import { DEFAULT_DELIVERY_SETTINGS } from "@/lib/orders/delivery";
import { getSetting } from "@/lib/queries/admin";
import type { Address, DeliverySettings } from "@/types/db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [profile, delivery] = await Promise.all([
    getProfile(),
    getSetting<DeliverySettings>("delivery"),
  ]);
  const addr = (profile?.default_address ?? undefined) as Partial<Address> | undefined;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <CheckoutForm
        defaults={{
          customerName: profile?.full_name ?? undefined,
          customerWhatsapp: profile?.whatsapp ?? undefined,
          address: addr,
        }}
        delivery={delivery ?? DEFAULT_DELIVERY_SETTINGS}
      />
    </div>
  );
}
