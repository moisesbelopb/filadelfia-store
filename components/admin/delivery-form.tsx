"use client";

import { saveDeliverySettings } from "@/actions/admin/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_DELIVERY_SETTINGS, WEEKDAYS } from "@/lib/orders/delivery";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import type { CityFee, DeliverySettings, DeliverySlot } from "@/types/db";
import {
  AlertTriangle,
  CalendarClock,
  Church,
  ClipboardList,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useState, useTransition } from "react";

const money = (v: string) => Math.max(0, Number(v.replace(",", ".")) || 0);

/**
 * Garante que os campos de lista existam mesmo quando o JSON salvo em `settings`
 * for antigo/parcial (ex.: sem `pickupSchedule`). Sem isso, abrir a aba Retirada
 * quebraria ao percorrer uma lista `undefined`.
 */
function normalize(settings: DeliverySettings | null): DeliverySettings {
  const s = settings ?? DEFAULT_DELIVERY_SETTINGS;
  return {
    ...DEFAULT_DELIVERY_SETTINGS,
    ...s,
    cityFees: Array.isArray(s.cityFees) ? s.cityFees : DEFAULT_DELIVERY_SETTINGS.cityFees,
    deliverySchedule: Array.isArray(s.deliverySchedule)
      ? s.deliverySchedule
      : DEFAULT_DELIVERY_SETTINGS.deliverySchedule,
    pickupSchedule: Array.isArray(s.pickupSchedule)
      ? s.pickupSchedule
      : DEFAULT_DELIVERY_SETTINGS.pickupSchedule,
  };
}

export function DeliveryForm({
  settings,
  report,
}: {
  settings: DeliverySettings | null;
  /** Conteúdo da aba "Relatórios" (renderizado no servidor e passado como slot). */
  report?: ReactNode;
}) {
  const [form, setForm] = useState<DeliverySettings>(() => normalize(settings));
  const [pending, startTransition] = useTransition();
  // "Relatórios" é a primeira aba (padrão). Controlada para esconder a barra de
  // salvar quando o relatório está ativo (lá não se salva nada).
  const [tab, setTab] = useState("relatorios");
  const isSettingsTab = tab === "entrega" || tab === "retirada";

  const patch = (p: Partial<DeliverySettings>) => setForm((f) => ({ ...f, ...p }));

  function updateCity(i: number, p: Partial<CityFee>) {
    patch({ cityFees: form.cityFees.map((c, idx) => (idx === i ? { ...c, ...p } : c)) });
  }

  function save() {
    startTransition(async () => {
      const res = await saveDeliverySettings(form);
      toast(
        res.ok
          ? { variant: "success", title: "Configuração de entrega salva" }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  const nothingOn = !form.deliveryEnabled && !form.pickupEnabled;

  return (
    <div className="flex flex-col gap-6 pb-4">
      {nothingOn && isSettingsTab && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          Nenhum modo ativo — ative Entrega ou Retirada para os clientes conseguirem finalizar
          pedidos.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="relatorios">
            <ClipboardList className="size-4" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="entrega">
            <Truck className="size-4" /> Config. Entrega <StatusDot on={form.deliveryEnabled} />
          </TabsTrigger>
          <TabsTrigger value="retirada">
            <Church className="size-4" /> Config. Retirada <StatusDot on={form.pickupEnabled} />
          </TabsTrigger>
        </TabsList>

        {/* ---------- RELATÓRIOS ---------- */}
        <TabsContent value="relatorios">{report}</TabsContent>

        {/* ---------- ENTREGA ---------- */}
        <TabsContent value="entrega" className="flex flex-col gap-4">
          <EnableCard
            icon={Truck}
            title="Entrega ativa"
            desc="Motoboy leva no endereço do cliente."
            checked={form.deliveryEnabled}
            onChange={(v) => patch({ deliveryEnabled: v })}
          />

          <Card>
            <CardContent className="flex flex-col gap-6 pt-4 sm:pt-6">
              {/* Taxas por cidade */}
              <section className="flex flex-col gap-3">
                <SubHead
                  title="Cidades atendidas"
                  hint="Só há entrega para as cidades listadas. O cliente paga a taxa — o mesmo valor repassado ao motoboy."
                />

                <div className="flex flex-col gap-2">
                  {form.cityFees.length > 0 && (
                    <div className="grid grid-cols-[1fr_6.5rem_2.75rem] gap-2 px-0.5">
                      <span className="text-xs font-medium text-muted-foreground">Cidade</span>
                      <span className="text-xs font-medium text-muted-foreground">Taxa</span>
                      <span className="sr-only">Ações</span>
                    </div>
                  )}

                  {form.cityFees.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Nenhuma cidade — a entrega fica indisponível para o cliente.
                    </div>
                  )}

                  {form.cityFees.map((c, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id estável
                    <div key={i} className="grid grid-cols-[1fr_6.5rem_2.75rem] items-center gap-2">
                      <Input
                        value={c.city}
                        onChange={(e) => updateCity(i, { city: e.target.value })}
                        placeholder="Nome da cidade"
                      />
                      <MoneyInput
                        value={String(c.fee)}
                        onChange={(e) => updateCity(i, { fee: money(e.target.value) })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${c.city || "cidade"}`}
                        onClick={() =>
                          patch({ cityFees: form.cityFees.filter((_, idx) => idx !== i) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => patch({ cityFees: [...form.cityFees, { city: "", fee: 0 }] })}
                >
                  <Plus className="size-4" /> Adicionar cidade
                </Button>
              </section>

              <Divider />

              {/* Horários de entrega */}
              <section className="flex flex-col gap-3">
                <SubHead
                  title="Dias e horários"
                  hint="Faixas que o cliente pode escolher ao pedir entrega."
                />
                <ScheduleEditor
                  slots={form.deliverySchedule}
                  onChange={(deliverySchedule) => patch({ deliverySchedule })}
                  addLabel="Adicionar horário"
                />
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- RETIRADA ---------- */}
        <TabsContent value="retirada" className="flex flex-col gap-4">
          <EnableCard
            icon={Church}
            title="Retirada ativa"
            desc="Cliente retira no local, no horário escolhido."
            checked={form.pickupEnabled}
            onChange={(v) => patch({ pickupEnabled: v })}
          />

          <Card>
            <CardContent className="flex flex-col gap-6 pt-4 sm:pt-6">
              {/* Horários de retirada */}
              <section className="flex flex-col gap-3">
                <SubHead
                  title="Dias e horários"
                  hint="Faixas que o cliente pode escolher ao retirar na igreja."
                />
                <ScheduleEditor
                  slots={form.pickupSchedule}
                  onChange={(pickupSchedule) => patch({ pickupSchedule })}
                  addLabel="Adicionar horário"
                />
              </section>

              <Divider />

              {/* Local e instruções */}
              <section className="flex flex-col gap-4">
                <SubHead title="Local e instruções" />
                <div className="flex flex-col gap-1.5">
                  <Label>Endereço da igreja</Label>
                  <Textarea
                    value={form.pickupAddress ?? ""}
                    onChange={(e) => patch({ pickupAddress: e.target.value })}
                    rows={2}
                    placeholder="Rua, número, bairro, cidade — CEP"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Instruções de retirada (opcional)</Label>
                  <Input
                    value={form.pickupInfo ?? ""}
                    onChange={(e) => patch({ pickupInfo: e.target.value })}
                    placeholder="Ex.: procure pela recepção"
                  />
                </div>
              </section>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Agendamento + salvar: só nas abas de configuração (não no relatório). */}
      {isSettingsTab && (
        <>
          {/* Compartilhado pelos dois modos */}
          <Card>
            <CardHeader className="flex-row items-center gap-3 border-b border-border/70 pb-4">
              <IconChip icon={CalendarClock} />
              <div className="min-w-0">
                <CardTitle className="text-base">Agendamento</CardTitle>
                <CardDescription>Vale para entrega e retirada.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6">
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Agendar com até</Label>
                <div className="relative w-40">
                  <Input
                    inputMode="numeric"
                    className="pr-12"
                    value={String(form.leadDays)}
                    onChange={(e) =>
                      patch({ leadDays: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    dias
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  O cliente vê as próximas datas disponíveis dentro desse período.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Barra de salvar fixa */}
          <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-t border-border bg-background/85 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <p className="hidden text-xs text-muted-foreground sm:block">
              As mudanças valem no checkout logo após salvar.
            </p>
            <Button onClick={save} disabled={pending} className="w-full sm:w-fit">
              {pending ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ScheduleEditor({
  slots,
  onChange,
  addLabel,
}: {
  slots: DeliverySlot[];
  onChange: (slots: DeliverySlot[]) => void;
  addLabel: string;
}) {
  const update = (i: number, p: Partial<DeliverySlot>) =>
    onChange(slots.map((s, idx) => (idx === i ? { ...s, ...p } : s)));

  return (
    <div className="flex flex-col gap-2">
      {slots.length > 0 && (
        <div className="hidden px-0.5 sm:flex sm:gap-2">
          <span className="flex-1 text-xs font-medium text-muted-foreground">Dia</span>
          <span className="w-[7rem] text-xs font-medium text-muted-foreground">Início</span>
          <span className="w-[7rem] text-xs font-medium text-muted-foreground">Fim</span>
          <span className="w-11" />
        </div>
      )}

      {slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum horário — este modo fica indisponível para o cliente.
        </div>
      ) : (
        slots.map((s, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: linhas editáveis sem id estável
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border/60 p-2.5 sm:flex-row sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:p-0"
          >
            <div className="sm:flex-1">
              <Label className="mb-1 block text-xs text-muted-foreground sm:hidden">Dia</Label>
              <Select
                value={String(s.weekday)}
                onChange={(e) => update(i, { weekday: Number(e.target.value) })}
              >
                {WEEKDAYS.map((d, idx) => (
                  <option key={d} value={idx}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <div className="sm:w-[7rem]">
                <Label className="mb-1 block text-xs text-muted-foreground sm:hidden">Início</Label>
                <Input
                  type="time"
                  value={s.start}
                  onChange={(e) => update(i, { start: e.target.value })}
                />
              </div>
              <div className="sm:w-[7rem]">
                <Label className="mb-1 block text-xs text-muted-foreground sm:hidden">Fim</Label>
                <Input
                  type="time"
                  value={s.end}
                  onChange={(e) => update(i, { end: e.target.value })}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remover horário"
              className="self-end sm:self-auto"
              onClick={() => onChange(slots.filter((_, idx) => idx !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => onChange([...slots, { weekday: 2, start: "14:00", end: "18:00" }])}
      >
        <Plus className="size-4" /> {addLabel}
      </Button>
    </div>
  );
}

/** Cabeçalho do modo com switch de ativação. */
function EnableCard({
  icon,
  title,
  desc,
  checked,
  onChange,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <IconChip icon={icon} active={checked} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        </div>
        <Switch checked={checked} onChange={onChange} label={title} />
      </CardContent>
    </Card>
  );
}

/** Switch acessível (role=switch) com aparência de toggle. */
function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Ativar ${label}`}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-background shadow-sm transition-all",
          checked ? "left-[1.375rem]" : "left-0.5",
        )}
      />
    </button>
  );
}

/** Bolinha de status na aba (verde = ativo). */
function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 rounded-full", on ? "bg-success" : "bg-muted-foreground/40")}
    />
  );
}

function MoneyInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        inputMode="decimal"
        value={value}
        onChange={onChange}
        className="pl-9 text-right tabular-nums"
      />
    </div>
  );
}

function IconChip({
  icon: Icon,
  active = false,
}: {
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

function SubHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border/70" />;
}
