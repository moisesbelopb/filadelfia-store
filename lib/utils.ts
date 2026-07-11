import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata número como moeda BRL. */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Gera slug a partir de um texto (remove acentos e caracteres inválidos). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Normaliza telefone para o formato E.164 sem símbolos (ex.: 5599999999999). */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  // Assume Brasil (55) quando o DDI não vem informado.
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

/**
 * Garante que um destino de redirect é um caminho interno (evita open redirect).
 * Aceita só caminhos relativos que começam com "/" e não escapam para outro host
 * ("//evil.com", "/\\evil.com"). Caso contrário, usa o fallback.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) {
    return fallback;
  }
  return path;
}

/** Formata data/hora curta em pt-BR. */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
