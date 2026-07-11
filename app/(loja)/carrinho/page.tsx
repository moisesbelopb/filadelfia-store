import { CartView } from "@/components/loja/cart-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Carrinho" };

export default function CarrinhoPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <CartView />
    </div>
  );
}
