import { DeliveryForm } from "@/components/admin/delivery-form";
import { DeliveryReportView } from "@/components/admin/delivery-report-view";
import { resolvePeriod } from "@/lib/dashboard-period";
import { getDeliveryReport, getSetting } from "@/lib/queries/admin";
import type { DeliverySettings } from "@/types/db";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entregas" };

// Depende do período do relatório (searchParams) e da data atual.
export const dynamic = "force-dynamic";

export default async function DeliveryConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const { period, from, to } = await searchParams;
  const range = resolvePeriod(period, from, to);

  const [settings, report] = await Promise.all([
    getSetting<DeliverySettings>("delivery"),
    getDeliveryReport({ start: range.start, end: range.end }),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">Entregas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>Relatórios</strong> das entregas realizadas (para o repasse ao motoboy) e as
          regras de <strong>entrega</strong> e <strong>retirada na igreja</strong> que o cliente vê
          no checkout.
        </p>
      </div>

      <DeliveryForm
        settings={settings}
        report={<DeliveryReportView report={report} range={range} />}
      />
    </div>
  );
}
