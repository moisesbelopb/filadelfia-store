/**
 * Resolve o período do dashboard (hoje / mês / intervalo) em datas ISO.
 * As bordas são calculadas no fuso de São Paulo (UTC−3 fixo — o Brasil não
 * usa horário de verão desde 2019), então "hoje" e "este mês" batem com o
 * calendário do lojista, não com o UTC.
 */

const SP_TZ = "America/Sao_Paulo";
const SP_OFFSET = "-03:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type PeriodKey = "hoje" | "mes" | "custom";

export interface ResolvedPeriod {
  period: PeriodKey;
  /** Início do intervalo (ISO com fuso). */
  start: string;
  /** Fim do intervalo (ISO). */
  end: string;
  /** Rótulo amigável do período ativo. */
  label: string;
  /** Datas YYYY-MM-DD para preencher o formulário de intervalo. */
  from: string;
  to: string;
}

/** Data atual em São Paulo no formato YYYY-MM-DD (en-CA usa esse padrão). */
function spToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SP_TZ }).format(new Date());
}

/** YYYY-MM-DD → DD/MM/YYYY. */
function fmtBR(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Rótulo do mês (ex.: "Julho de 2026"). */
function monthLabel(ymd: string): string {
  const [y, m] = ymd.split("-");
  const dt = new Date(`${y}-${m}-15T12:00:00${SP_OFFSET}`);
  const s = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: SP_TZ,
  }).format(dt);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function resolvePeriod(
  periodRaw?: string,
  fromRaw?: string,
  toRaw?: string,
): ResolvedPeriod {
  const today = spToday();
  const nowISO = new Date().toISOString();

  if (periodRaw === "hoje") {
    return {
      period: "hoje",
      start: `${today}T00:00:00${SP_OFFSET}`,
      end: nowISO,
      label: `Hoje · ${fmtBR(today)}`,
      from: today,
      to: today,
    };
  }

  if (periodRaw === "custom" && fromRaw && toRaw && DATE_RE.test(fromRaw) && DATE_RE.test(toRaw)) {
    // Aceita o intervalo mesmo se vier invertido (troca from/to).
    const [from, to] = fromRaw <= toRaw ? [fromRaw, toRaw] : [toRaw, fromRaw];
    return {
      period: "custom",
      start: `${from}T00:00:00${SP_OFFSET}`,
      end: `${to}T23:59:59.999${SP_OFFSET}`,
      label: from === to ? fmtBR(from) : `${fmtBR(from)} – ${fmtBR(to)}`,
      from,
      to,
    };
  }

  // Padrão: mês atual, do dia 1 até agora.
  const first = `${today.slice(0, 7)}-01`;
  return {
    period: "mes",
    start: `${first}T00:00:00${SP_OFFSET}`,
    end: nowISO,
    label: monthLabel(today),
    from: first,
    to: today,
  };
}
