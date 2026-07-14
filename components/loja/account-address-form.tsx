"use client";

import { updateAddressAction } from "@/actions/account";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { findCityFee } from "@/lib/orders/delivery";
import { toast } from "@/lib/use-toast";
import { formatBRL } from "@/lib/utils";
import { type AccountAddressInput, accountAddressSchema } from "@/lib/validators/account";
import type { Address, DeliverySettings } from "@/types/db";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function AccountAddressForm({
  address,
  delivery,
}: {
  address: Address | null;
  delivery: DeliverySettings;
}) {
  const [cepLoading, setCepLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AccountAddressInput>({
    resolver: zodResolver(accountAddressSchema),
    defaultValues: {
      street: address?.street ?? "",
      number: address?.number ?? "",
      complement: address?.complement ?? "",
      neighborhood: address?.neighborhood ?? "",
      city: address?.city ?? "",
      state: address?.state ?? "PB",
      zip: address?.zip ?? "",
    },
  });

  const city = watch("city") ?? "";
  const cityFee = findCityFee(delivery, city);

  /** Cidade e UF vêm do CEP (ViaCEP) — é o que garante o nome exato da cidade. */
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
      if (data.logradouro) setValue("street", data.logradouro, { shouldValidate: true });
      if (data.bairro) setValue("neighborhood", data.bairro, { shouldValidate: true });
      if (data.localidade)
        setValue("city", data.localidade, { shouldValidate: true, shouldDirty: true });
      if (data.uf) setValue("state", data.uf, { shouldValidate: true });
    } catch {
      toast({ variant: "error", title: "Não foi possível buscar o CEP" });
    } finally {
      setCepLoading(false);
    }
  }

  async function onSubmit(values: AccountAddressInput) {
    const res = await updateAddressAction(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
      return;
    }
    reset(values);
    toast({
      variant: "success",
      title: "Endereço salvo",
      description: "Ele já vem preenchido no seu próximo pedido.",
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Endereço de entrega</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Field label="CEP" error={errors.zip?.message}>
              <div className="relative">
                <Input
                  {...register("zip", { onChange: (e) => lookupCep(e.target.value) })}
                  inputMode="numeric"
                  placeholder="00000-000"
                  autoComplete="postal-code"
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
              Digite o CEP — a rua, o bairro e a cidade são preenchidos automaticamente.
            </p>
          </div>

          <div className="sm:col-span-4">
            <Field label="Rua" error={errors.street?.message}>
              <Input {...register("street")} autoComplete="address-line1" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Número" error={errors.number?.message}>
              <Input {...register("number")} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Bairro" error={errors.neighborhood?.message}>
              <Input {...register("neighborhood")} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Complemento (opcional)" error={errors.complement?.message}>
              <Input {...register("complement")} placeholder="Apto, bloco, ponto de referência" />
            </Field>
          </div>
          <div className="sm:col-span-4">
            <Field label="Cidade" error={errors.city?.message}>
              <Input {...register("city")} readOnly className="bg-secondary/40" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="UF" error={errors.state?.message}>
              <Input {...register("state")} maxLength={2} readOnly className="bg-secondary/40" />
            </Field>
          </div>

          {city &&
            (cityFee ? (
              <p className="rounded-md bg-secondary/60 p-3 text-xs sm:col-span-6">
                Entregamos em <strong>{city}</strong> — taxa de{" "}
                <strong className="text-foreground">{formatBRL(cityFee.fee)}</strong>.
              </p>
            ) : (
              <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground sm:col-span-6">
                ⚠ Ainda não entregamos em <strong>{city}</strong>. Você pode guardar o endereço, mas
                no pedido precisará escolher <strong>retirada na igreja</strong>.
              </p>
            ))}

          <div className="flex justify-end sm:col-span-6">
            <Button type="submit" disabled={isSubmitting || !isDirty}>
              {isSubmitting ? "Salvando..." : "Salvar endereço"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
