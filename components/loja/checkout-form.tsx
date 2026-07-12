"use client";

import { placeOrder } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { findCityFee, upcomingSlots } from "@/lib/orders/delivery";
import { toast } from "@/lib/use-toast";
import { cn, formatBRL } from "@/lib/utils";
import { type CheckoutInput, checkoutSchema } from "@/lib/validators/checkout";
import { cartSubtotal, useCart } from "@/stores/cart";
import type { DeliverySettings, FulfillmentType } from "@/types/db";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { type FieldErrors, useForm } from "react-hook-form";

/** Primeira mensagem de erro do formulário (percorre aninhados como address.*). */
function firstErrorMessage(errs: unknown): string | undefined {
  if (!errs || typeof errs !== "object") return undefined;
  const o = errs as Record<string, unknown>;
  if (typeof o.message === "string" && o.message) return o.message;
  for (const [k, v] of Object.entries(o)) {
    if (k === "ref" || k === "type") continue;
    const m = firstErrorMessage(v);
    if (m) return m;
  }
  return undefined;
}

export function CheckoutForm({
  defaults,
  delivery,
}: {
  defaults?: Partial<{
    customerName: string;
    customerWhatsapp: string;
    address: Partial<CheckoutInput["address"]>;
  }>;
  delivery: DeliverySettings;
}) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const [mounted, setMounted] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  useEffect(() => setMounted(true), []);

  const modes: FulfillmentType[] = [];
  if (delivery.deliveryEnabled) modes.push("entrega");
  if (delivery.pickupEnabled) modes.push("retirada");
  const availableModes = modes.length ? modes : (["entrega"] as FulfillmentType[]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: defaults?.customerName ?? "",
      customerWhatsapp: defaults?.customerWhatsapp ?? "",
      fulfillment: availableModes[0],
      paymentMethod: "pix",
      notes: "",
      scheduledDate: "",
      scheduledWindow: "",
      address: {
        street: defaults?.address?.street ?? "",
        number: defaults?.address?.number ?? "",
        complement: defaults?.address?.complement ?? "",
        neighborhood: defaults?.address?.neighborhood ?? "",
        city: defaults?.address?.city ?? "",
        state: defaults?.address?.state ?? "PB",
        zip: defaults?.address?.zip ?? "",
      },
    },
  });

  const fulfillment = watch("fulfillment");
  const city = watch("address.city") ?? "";
  const paymentMethod = watch("paymentMethod");
  const scheduledDate = watch("scheduledDate");
  const scheduledWindow = watch("scheduledWindow");
  const isDelivery = fulfillment === "entrega";

  const cityFee = isDelivery ? findCityFee(delivery, city) : undefined;
  const served = Boolean(cityFee);
  const fee = cityFee?.fee ?? 0;

  const slots = useMemo(() => {
    if (!mounted) return [];
    const schedule = isDelivery ? delivery.deliverySchedule : delivery.pickupSchedule;
    return upcomingSlots(schedule, delivery.leadDays);
  }, [mounted, isDelivery, delivery]);

  function chooseMode(m: FulfillmentType) {
    setValue("fulfillment", m, { shouldValidate: false });
    // As agendas diferem por modo: limpa o slot anterior.
    setValue("scheduledDate", "");
    setValue("scheduledWindow", "");
  }

  // Busca o endereço pelo CEP (ViaCEP) e preenche cidade/rua/bairro/UF.
  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await res.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        toast({ variant: "error", title: "CEP não encontrado" });
        return;
      }
      if (data.logradouro) setValue("address.street", data.logradouro, { shouldValidate: true });
      if (data.bairro) setValue("address.neighborhood", data.bairro, { shouldValidate: true });
      if (data.localidade) setValue("address.city", data.localidade, { shouldValidate: true });
      if (data.uf) setValue("address.state", data.uf, { shouldValidate: true });
    } catch {
      toast({ variant: "error", title: "Não foi possível buscar o CEP" });
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(values: CheckoutInput) {
    if (values.fulfillment === "entrega" && !findCityFee(delivery, values.address?.city ?? "")) {
      toast({
        variant: "error",
        title: "Cidade não atendida",
        description: "Ainda não entregamos nessa cidade. Você pode escolher retirada na igreja.",
      });
      return;
    }
    const payload = items.map((i) => ({
      variantId: i.variantId,
      productId: i.productId,
      quantity: i.quantity,
    }));
    const res = await placeOrder(values, payload);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível finalizar", description: res.error });
      return;
    }
    clear();
    toast({ variant: "success", title: `Pedido #${res.data.orderNumber} enviado!` });
    router.push(`/pedidos/${res.data.orderId}`);
  }

  // Sem isso, uma validação que falha simplesmente não faz nada ("nada acontece").
  function onInvalid(errs: FieldErrors<CheckoutInput>) {
    toast({
      variant: "error",
      title: "Revise o formulário",
      description: firstErrorMessage(errs) ?? "Preencha os campos destacados em vermelho.",
    });
  }

  if (mounted && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="font-medium">Seu carrinho está vazio</p>
        <Button asChild>
          <Link href="/">Ver produtos</Link>
        </Button>
      </div>
    );
  }

  const subtotal = mounted ? cartSubtotal(items) : 0;
  const total = subtotal + fee;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="flex flex-col gap-4 pb-[calc(10rem_+_env(safe-area-inset-bottom))] sm:pb-28"
    >
      <h1 className="text-xl font-semibold">Finalizar pedido</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seus dados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Nome completo" error={errors.customerName?.message}>
            <Input {...register("customerName")} autoComplete="name" />
          </Field>
          <Field label="WhatsApp (com DDD)" error={errors.customerWhatsapp?.message}>
            <Input
              {...register("customerWhatsapp")}
              inputMode="tel"
              placeholder="(11) 99999-9999"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Entrega x Retirada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como quer receber?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {availableModes.length > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {availableModes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => chooseMode(m)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-sm font-medium transition-colors",
                    fulfillment === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {m === "entrega" ? "🛵 Entrega" : "⛪ Retirada na igreja"}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isDelivery ? "Entrega no seu endereço." : "Retirada na igreja."}
            </p>
          )}

          {/* Agendamento */}
          <Field
            label={isDelivery ? "Dia e horário da entrega" : "Dia e horário da retirada"}
            error={errors.scheduledDate?.message ?? errors.scheduledWindow?.message}
          >
            {slots.length === 0 ? (
              <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
                {mounted
                  ? "Sem horários disponíveis para este modo no momento."
                  : "Carregando horários…"}
              </p>
            ) : (
              <Select
                value={
                  scheduledDate && scheduledWindow ? `${scheduledDate}__${scheduledWindow}` : ""
                }
                onChange={(e) => {
                  const [date, window] = e.target.value.split("__");
                  setValue("scheduledDate", date ?? "", { shouldValidate: true });
                  setValue("scheduledWindow", window ?? "", { shouldValidate: true });
                }}
              >
                <option value="">Escolha um horário</option>
                {slots.map((s) => (
                  <option key={s.key} value={`${s.date}__${s.window}`}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {!isDelivery && delivery.pickupAddress && (
            <div className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Local da retirada</p>
              <p>{delivery.pickupAddress}</p>
              {delivery.pickupInfo && <p className="mt-1">{delivery.pickupInfo}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endereço (só na entrega) */}
      {isDelivery && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço de entrega</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Field label="CEP" error={errors.address?.zip?.message}>
                <div className="relative">
                  <Input
                    {...register("address.zip", { onChange: (e) => lookupCep(e.target.value) })}
                    inputMode="numeric"
                    placeholder="00000-000"
                  />
                  {cepLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      buscando…
                    </span>
                  )}
                </div>
              </Field>
            </div>
            <div className="flex items-center sm:col-span-4">
              <p className="text-xs text-muted-foreground">
                Digite o CEP — a cidade e a taxa de entrega são preenchidas automaticamente.
              </p>
            </div>
            <div className="sm:col-span-4">
              <Field label="Rua" error={errors.address?.street?.message}>
                <Input {...register("address.street")} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Número" error={errors.address?.number?.message}>
                <Input {...register("address.number")} />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Bairro" error={errors.address?.neighborhood?.message}>
                <Input {...register("address.neighborhood")} />
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field label="Complemento (opcional)" error={errors.address?.complement?.message}>
                <Input {...register("address.complement")} />
              </Field>
            </div>
            <div className="sm:col-span-4">
              <Field label="Cidade" error={errors.address?.city?.message}>
                <Input {...register("address.city")} readOnly className="bg-secondary/40" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="UF" error={errors.address?.state?.message}>
                <Input
                  {...register("address.state")}
                  maxLength={2}
                  readOnly
                  className="bg-secondary/40"
                />
              </Field>
            </div>

            {city &&
              (served ? (
                <p className="rounded-md bg-secondary/60 p-3 text-xs sm:col-span-6">
                  Taxa de entrega para <strong>{city}</strong>:{" "}
                  <strong className="text-foreground">{formatBRL(fee)}</strong>
                </p>
              ) : (
                <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground sm:col-span-6">
                  ⚠ Ainda não entregamos em <strong>{city}</strong>. Você pode escolher{" "}
                  <strong>retirada na igreja</strong>.
                </p>
              ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pagamento na {isDelivery ? "entrega" : "retirada"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Field label="Forma de pagamento" error={errors.paymentMethod?.message}>
            <Select {...register("paymentMethod")}>
              <option value="pix">Pix</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão (maquininha)</option>
            </Select>
          </Field>
          {paymentMethod === "cartao" && isDelivery && (
            <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
              🛵 O <strong>motoboy leva a maquineta</strong> para o pagamento no cartão.
            </p>
          )}
          <Field label="Observação (opcional)" error={errors.notes?.message}>
            <Textarea {...register("notes")} placeholder="Ponto de referência, troco, etc." />
          </Field>
          <p className="rounded-md bg-secondary/60 p-3 text-xs text-muted-foreground">
            Se escolher <strong>Pix</strong>, a chave é enviada por e-mail/WhatsApp somente
            <strong> após a equipe aceitar</strong> seu pedido.
          </p>
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem_+_env(safe-area-inset-bottom))] z-30 border-t border-border bg-background/95 p-4 backdrop-blur sm:bottom-0 sm:pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div className="flex flex-col">
            {isDelivery && fee > 0 && (
              <span className="text-[0.7rem] text-muted-foreground">
                Itens {formatBRL(subtotal)} + entrega {formatBRL(fee)}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-bold">{formatBRL(total)}</span>
          </div>
          <Button
            type="submit"
            size="lg"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enviando..." : "Enviar pedido"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
