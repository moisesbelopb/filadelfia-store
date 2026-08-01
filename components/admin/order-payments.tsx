"use client";

import { addOrderPayment, deleteOrderPayment } from "@/actions/admin/payments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MAX_INSTALLMENTS } from "@/lib/orders/card-fees";
import { toast } from "@/lib/use-toast";
import { cn, formatBRL } from "@/lib/utils";
import type { OrderPayment, PaymentMethod } from "@/types/db";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão de crédito",
};

function parseBRL(s: string): number {
  const n = Number.parseFloat(
    s
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", "."),
  );
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Pagamentos do pedido: registrar (parcial ou total), ver saldo devedor e remover. */
export function OrderPayments({
  orderId,
  total,
  payments,
}: {
  orderId: string;
  total: number;
  payments: OrderPayment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const saldo = Math.max(0, total - paid);
  const isPago = saldo <= 0 && paid > 0;

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [installments, setInstallments] = useState(1);

  function add() {
    const value = parseBRL(amount);
    if (!value) {
      toast({ variant: "error", title: "Informe o valor do pagamento" });
      return;
    }
    startTransition(async () => {
      const res = await addOrderPayment({
        orderId,
        amount: value,
        method,
        cardInstallments: method === "cartao" ? installments : null,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível registrar", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Pagamento registrado" });
      setAmount("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteOrderPayment(id, orderId);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
      else {
        toast({ variant: "success", title: "Pagamento removido" });
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Pagamentos</CardTitle>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
            isPago ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          {isPago ? "Pago" : "Pendente"}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Resumo */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total do pedido</span>
            <span className="font-medium tabular-nums">{formatBRL(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recebido</span>
            <span className="font-medium tabular-nums text-success">{formatBRL(paid)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm font-semibold">Saldo devedor</span>
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                saldo > 0 ? "text-warning" : "text-success",
              )}
            >
              {formatBRL(saldo)}
            </span>
          </div>
        </div>

        {/* Pagamentos registrados */}
        {payments.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="flex-1 font-medium">
                  {METHOD_LABEL[p.method]}
                  {p.method === "cartao" && p.card_installments ? (
                    <span className="text-muted-foreground"> · {p.card_installments}x</span>
                  ) : null}
                </span>
                <span className="font-semibold tabular-nums">{formatBRL(Number(p.amount))}</span>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  disabled={pending}
                  className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                  aria-label="Remover pagamento"
                  title="Remover"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Registrar pagamento (some quando quitado) */}
        {saldo > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-secondary/30 p-3">
            <p className="text-sm font-medium">Registrar pagamento</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-input bg-background px-2.5">
                <span className="text-sm text-muted-foreground">R$</span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-24 border-0 px-1 shadow-none focus-visible:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={() => setAmount(saldo.toFixed(2).replace(".", ","))}
                className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                usar saldo ({formatBRL(saldo)})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["dinheiro", "pix", "cartao"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-sm font-medium transition-colors",
                    method === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {m === "cartao" ? "Cartão" : METHOD_LABEL[m]}
                </button>
              ))}
            </div>
            {method === "cartao" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Parcelas</span>
                <Select
                  value={String(installments)}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button
              type="button"
              onClick={add}
              disabled={pending}
              variant="success"
              className="w-fit"
            >
              {pending ? "Salvando..." : "Registrar pagamento"}
            </Button>
          </div>
        ) : (
          <p className="rounded-md bg-success/10 p-2.5 text-xs text-success">
            ✓ Pedido totalmente pago.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
