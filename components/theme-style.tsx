import { type VisualSettings, buildThemeCss } from "@/lib/theme";

/**
 * Injeta as variáveis de tema em :root para re-tematizar toda a loja.
 * Server component — o CSS é calculado no servidor a partir das configurações.
 */
export function ThemeStyle({ settings }: { settings: VisualSettings | null }) {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS derivado de valores validados (cores/números)
  return <style id="theme-vars" dangerouslySetInnerHTML={{ __html: buildThemeCss(settings) }} />;
}
