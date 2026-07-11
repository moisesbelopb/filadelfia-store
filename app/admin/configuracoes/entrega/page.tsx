import { DeliveryForm } from "@/components/admin/delivery-form";
import { getSetting } from "@/lib/queries/admin";
import type { DeliverySettings } from "@/types/db";

export default async function DeliveryConfigPage() {
  const settings = await getSetting<DeliverySettings>("delivery");

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">Entrega</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Taxas por cidade, dias e horários disponíveis e endereço para retirada. O cliente escolhe
          entre <strong>entrega</strong> ou <strong>retirada na igreja</strong> no checkout.
        </p>
      </div>

      <DeliveryForm settings={settings} />
    </div>
  );
}
