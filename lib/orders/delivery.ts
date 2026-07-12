import type { DeliverySettings, DeliverySlot } from "@/types/db";

export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Configuração padrão de entrega. Pré-preenche o painel e serve de fallback
 * quando nada foi salvo (ex.: modo demo). Tudo editável no admin.
 */
export const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  deliveryEnabled: true,
  pickupEnabled: true,
  cityFees: [
    { city: "João Pessoa", fee: 12 },
    { city: "Bayeux", fee: 14 },
    { city: "Santa Rita", fee: 14 },
    { city: "Cabedelo", fee: 14 },
  ],
  deliverySchedule: [
    { weekday: 2, start: "14:00", end: "18:00" },
    { weekday: 4, start: "14:00", end: "18:00" },
    { weekday: 6, start: "09:00", end: "12:00" },
  ],
  pickupSchedule: [
    { weekday: 0, start: "09:00", end: "12:00" },
    { weekday: 3, start: "19:00", end: "21:00" },
  ],
  leadDays: 14,
  pickupAddress:
    "R. Iracema Mariano Araújo, S/N - Lote 13 - Jardim Veneza, João Pessoa - PB, 58084-546",
  pickupInfo: "Retire na igreja no dia e horário escolhidos.",
};

/** Normaliza cidade para comparação (sem acento, minúsculo, sem espaços extra). */
function normCity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Retorna a cidade atendida correspondente (ou undefined se não entregamos lá). */
export function findCityFee(settings: DeliverySettings, city: string) {
  if (!city.trim()) return undefined;
  return settings.cityFees.find((c) => normCity(c.city) === normCity(city));
}

/** Taxa de entrega para uma cidade listada (0 se a cidade não for atendida). */
export function feeForCity(settings: DeliverySettings, city: string): number {
  return findCityFee(settings, city)?.fee ?? 0;
}

/** Rótulo curto de um horário. Ex.: "14:00–18:00". */
export function slotLabel(start: string, end: string): string {
  return `${start}–${end}`;
}

/**
 * Formata um agendamento salvo (data ISO + faixa) para exibição.
 * Ex.: ("2026-07-16", "14:00-18:00") → "Qui, 16/07 · 14:00–18:00".
 */
export function formatScheduled(date: string | null, window: string | null): string {
  if (!date) return window ? window.replace("-", "–") : "";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return window ? window.replace("-", "–") : "";
  const dt = new Date(y, m - 1, d);
  const dm = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  const win = window ? ` · ${window.replace("-", "–")}` : "";
  return `${WEEKDAYS_SHORT[dt.getDay()]}, ${dm}${win}`;
}

export interface UpcomingSlot {
  /** Chave estável: "2026-07-16__14:00-18:00". */
  key: string;
  /** Data ISO "YYYY-MM-DD". */
  date: string;
  /** Faixa "HH:MM-HH:MM" (persistida no pedido). */
  window: string;
  /** Rótulo amigável, ex.: "Qui, 16/07 · 14:00–18:00". */
  label: string;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Gera as próximas datas concretas a partir de um schedule (dias da semana +
 * faixas), dentro de `leadDays` dias. Chamado no cliente (usa a data de hoje).
 */
export function upcomingSlots(
  schedule: DeliverySlot[],
  leadDays: number,
  from: Date = new Date(),
): UpcomingSlot[] {
  const byWeekday = new Map<number, DeliverySlot[]>();
  for (const s of schedule) {
    const arr = byWeekday.get(s.weekday) ?? [];
    arr.push(s);
    byWeekday.set(s.weekday, arr);
  }

  const out: UpcomingSlot[] = [];
  // Cada (dia da semana + faixa) aparece só na PRÓXIMA ocorrência — evita ver o
  // mesmo dia/horário repetido para várias semanas (recorrência = "duplicado").
  const seen = new Set<string>();
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i <= leadDays; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const daySlots = byWeekday.get(d.getDay());
    if (!daySlots?.length) continue;
    const dateIso = iso(d);
    const dm = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    for (const s of daySlots) {
      const window = `${s.start}-${s.end}`;
      const key = `${d.getDay()}-${window}`;
      if (seen.has(key)) continue;
      // Hoje: não oferece faixa que já começou (a próxima semana entra no lugar).
      if (i === 0) {
        const [hh, mm] = s.start.split(":").map(Number);
        const start = new Date(d);
        start.setHours(hh ?? 0, mm ?? 0, 0, 0);
        if (start <= from) continue;
      }
      seen.add(key);
      out.push({
        key: `${dateIso}__${window}`,
        date: dateIso,
        window,
        label: `${WEEKDAYS_SHORT[d.getDay()]}, ${dm} · ${s.start}–${s.end}`,
      });
    }
  }
  return out;
}
