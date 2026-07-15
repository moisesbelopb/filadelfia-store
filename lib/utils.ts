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
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  // Já vem com o DDI 55 (12 dígitos p/ fixo, 13 p/ celular): não duplica o 55.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  // Sem DDI: assume Brasil (55).
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

/**
 * Nome próprio: primeira letra de cada palavra em maiúscula, o resto minúsculo.
 * Ex.: "moises da silva belo" → "Moises Da Silva Belo".
 * Preserva o comprimento (permite manter o cursor no lugar ao digitar).
 */
export function titleCaseName(input: string): string {
  return input
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|[\s'-])(\S)/g,
      (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}

/**
 * Máscara de telefone brasileiro: (DD) XXXXX-XXXX (celular, 11 dígitos) ou
 * (DD) XXXX-XXXX (fixo, 10). Descarta qualquer caractere que não seja dígito —
 * é isso que impede letras no campo.
 */
export function maskPhone(input: string): string {
  let raw = input.replace(/\D/g, "");
  // Número colado/preenchido com o DDI 55 (12–13 dígitos): descarta o 55 para
  // não confundir o código do país com o DDD (senão os dígitos finais somem).
  if (raw.length > 11 && raw.startsWith("55")) raw = raw.slice(2);
  const d = raw.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** True se o telefone tem DDD + número válidos (10 ou 11 dígitos). */
export function isValidPhone(input: string): boolean {
  const d = input.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
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
