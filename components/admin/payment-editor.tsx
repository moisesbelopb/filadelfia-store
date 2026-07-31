"use client";

import { updateOrderPayment } from "@/actions/admin/orders";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import {
  CARD_BRANDS,
  type CardBrand,
  MAX_INSTALLMENTS,
  cardInstallmentValue,
  cardTotal,
} from "@/lib/orders/card-fees";
import { toast } from "@/lib/use-toast";
import { cn, formatBRL } from "@/lib/utils";
import type { PaymentMethod } from "@/types/db";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Admin corrige a forma de pagamento do pedido (deixa fiel ao que foi pago). */
export function PaymentEditor({
  orderId,
  total,
  paymentMethod,
  cardBrand,
  cardInstallments,
}: {
  orderId: string;
  total: number;
  paymentMethod: PaymentMethod;
  cardBrand: CardBrand | null;
  cardInstallments: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState<PaymentMethod>(paymentMethod);
  const [brand, setBrand] = useState<CardBrand | "">(cardBrand ?? "");
  const [installments, setInstallments] = useState<number>(cardInstallments ?? 1);

  function save() {
    startTransition(async () => {
      const res = await updateOrderPayment({
        orderId,
        paymentMethod: method,
        cardBrand: method === "cartao" ? brand || null : null,
        cardInstallments: method === "cartao" ? installments : null,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Forma de pagamento atualizada" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 w-fit"
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-3.5" /> Editar forma de pagamento
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar forma de pagamento</DialogTitle>
            <DialogDescription>
              Corrija para ficar fiel ao que o cliente pagou de fato na retirada/entrega.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Forma de pagamento</span>
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão de crédito</option>
              </Select>
            </div>

            {method === "cartao" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Bandeira</span>
                  <div className="grid grid-cols-3 gap-2">
                    {CARD_BRANDS.map((b) => (
                      <button
                        key={b.value}
                        type="button"
                        onClick={() => setBrand(b.value)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                          brand === b.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-secondary",
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Parcelas</span>
                  <Select
                    value={String(installments)}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                  >
                    {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x{n === 1 ? " (Vencimento)" : ""}
                      </option>
                    ))}
                  </Select>
                </div>

                {brand && (
                  <p className="rounded-md bg-secondary/60 p-2.5 text-xs">
                    {installments}x de{" "}
                    <strong>{formatBRL(cardInstallmentValue(brand, installments, total))}</strong> ·
                    total <strong>{formatBRL(cardTotal(brand, installments, total))}</strong>
                  </p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending || (method === "cartao" && !brand)}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
