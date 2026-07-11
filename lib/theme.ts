/**
 * Camada de tema visual da loja — fonte única de verdade.
 *
 * As mesmas variáveis alimentam a injeção global no storefront (buildThemeCss)
 * e o preview ao vivo do editor admin (themeVars), garantindo paridade total.
 * Princípios aplicados (pesquisa UX/UI): tokens semânticos, preview instantâneo
 * via CSS variables, glass em poucas superfícies e contraste automático (WCAG).
 */

export type VisualSettings = {
  /** Cor principal (marca) — mapeia para --primary. */
  primaryColor?: string;
  /** Cor de destaque — mapeia para --accent. */
  accentColor?: string;
  /** Raio das bordas em px — mapeia para --radius. */
  radius?: number;
  /** Liga o efeito de vidro (glassmorphism) no topo. */
  glass?: boolean;
  /** Desfoque do vidro em px (faixa recomendada 8–15). */
  glassBlur?: number;
  /** Opacidade do fundo do topo em % (quanto maior, mais sólido/legível). */
  glassOpacity?: number;
  logoUrl?: string;
  bannerUrl?: string;
};

export const DEFAULT_VISUAL: Required<VisualSettings> = {
  primaryColor: "#161616",
  accentColor: "#e8ddce",
  radius: 4,
  glass: true,
  glassBlur: 12,
  glassOpacity: 85,
  logoUrl: "/logo.png",
  bannerUrl: "",
};

/** Presets de partida rápida (pesquisa: presets aceleram a personalização). */
export const PRIMARY_PRESETS = [
  "#161616",
  "#0e7490",
  "#1d4ed8",
  "#7c3aed",
  "#db2777",
  "#dc2626",
  "#c2410c",
  "#16a34a",
];
export const ACCENT_PRESETS = ["#e8ddce", "#fde68a", "#bfdbfe", "#fbcfe8", "#bbf7d0", "#ddd6fe"];
export const RADIUS_PRESETS = [
  { label: "Reto", value: 0 },
  { label: "Sutil", value: 4 },
  { label: "Médio", value: 10 },
  { label: "Arredondado", value: 16 },
];

/** Preenche campos ausentes com os padrões, preservando valores explícitos. */
export function resolveVisual(
  settings: VisualSettings | null | undefined,
): Required<VisualSettings> {
  const out = { ...DEFAULT_VISUAL };
  if (!settings) return out;
  for (const key of Object.keys(DEFAULT_VISUAL) as (keyof Required<VisualSettings>)[]) {
    const value = settings[key];
    if (value !== undefined && value !== null) {
      // biome-ignore lint/suspicious/noExplicitAny: merge homogêneo de chaves conhecidas
      (out as any)[key] = value;
    }
  }
  return out;
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Escolhe texto claro ou escuro para garantir contraste legível sobre a cor. */
export function readableForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#faf7f2";
  return relativeLuminance(rgb) > 0.42 ? "#17150f" : "#faf7f2";
}

/** Conjunto de CSS variables derivado das configurações — usado no preview. */
export function themeVars(settings: VisualSettings | null | undefined): Record<string, string> {
  const v = resolveVisual(settings);
  const headerBg = v.glass
    ? `color-mix(in srgb, var(--background) ${v.glassOpacity}%, transparent)`
    : "var(--background)";
  const r = v.radius;
  return {
    "--primary": v.primaryColor,
    "--primary-foreground": readableForeground(v.primaryColor),
    "--ring": v.primaryColor,
    "--accent": v.accentColor,
    "--accent-foreground": readableForeground(v.accentColor),
    // Escala de raio explícita — garante que os tokens derivados (usados por
    // rounded-md/lg/xl) recomputem tanto no :root da loja quanto no preview.
    "--radius": `${r}px`,
    "--radius-sm": `${Math.max(0, r - 4)}px`,
    "--radius-md": `${Math.max(0, r - 2)}px`,
    "--radius-lg": `${r}px`,
    "--radius-xl": `${r + 4}px`,
    "--header-blur": v.glass ? `${v.glassBlur}px` : "0px",
    "--header-bg": headerBg,
  };
}

/** CSS para injeção global em :root no storefront (respeita reduced-transparency). */
export function buildThemeCss(settings: VisualSettings | null | undefined): string {
  const decl = Object.entries(themeVars(settings))
    .map(([k, val]) => `${k}:${val}`)
    .join(";");
  return `:root{${decl}}@media (prefers-reduced-transparency:reduce){:root{--header-blur:0px;--header-bg:var(--background)}}`;
}
