"use client";

import { saveVisualSettings } from "@/actions/admin/settings";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ACCENT_PRESETS,
  DEFAULT_VISUAL,
  PRIMARY_PRESETS,
  RADIUS_PRESETS,
  type VisualSettings,
  resolveVisual,
  themeVars,
} from "@/lib/theme";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  type LucideIcon,
  Palette,
  RotateCcw,
  ShoppingBag,
  SquareStack,
  Wand2,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useState, useTransition } from "react";

export function VisualForm({ settings }: { settings: VisualSettings | null }) {
  const [v, setV] = useState<Required<VisualSettings>>(() => resolveVisual(settings));
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Required<VisualSettings>>(
    key: K,
    value: Required<VisualSettings>[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveVisualSettings(v);
      toast(
        res.ok
          ? {
              variant: "success",
              title: "Identidade visual salva",
              description: "As mudanças já valem para a loja.",
            }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
      {/* Coluna de controles */}
      <div className="flex flex-col gap-4">
        <Section title="Cores" description="Cor principal e de destaque da loja." icon={Palette}>
          <ColorControl
            label="Cor principal"
            value={v.primaryColor}
            presets={PRIMARY_PRESETS}
            onChange={(c) => set("primaryColor", c)}
          />
          <ColorControl
            label="Cor de destaque"
            value={v.accentColor}
            presets={ACCENT_PRESETS}
            onChange={(c) => set("accentColor", c)}
          />
        </Section>

        <Section
          title="Cantos"
          description="Arredondamento de botões, cards e imagens."
          icon={SquareStack}
        >
          <div className="flex flex-col gap-2">
            <Label>Arredondamento</Label>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-border bg-muted p-1">
              {RADIUS_PRESETS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => set("radius", r.value)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    v.radius === r.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <RangeControl
            label="Ajuste fino"
            value={v.radius}
            min={0}
            max={24}
            suffix="px"
            onChange={(n) => set("radius", n)}
          />
        </Section>

        <Section
          title="Transparência (efeito de vidro)"
          description="Desfoque e opacidade da barra do topo da loja."
          icon={Wand2}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <Label className="cursor-default">Topo com efeito de vidro</Label>
              <p className="text-xs text-muted-foreground">
                Desfoca o conteúdo atrás da barra do topo da loja.
              </p>
            </div>
            <Switch
              checked={v.glass}
              onCheckedChange={(c) => set("glass", c)}
              aria-label="Ativar efeito de vidro"
            />
          </div>
          <RangeControl
            label="Desfoque"
            value={v.glassBlur}
            min={0}
            max={24}
            suffix="px"
            disabled={!v.glass}
            hint="Recomendado entre 8 e 15px para manter a leitura confortável."
            onChange={(n) => set("glassBlur", n)}
          />
          <RangeControl
            label="Opacidade do fundo"
            value={v.glassOpacity}
            min={40}
            max={100}
            suffix="%"
            disabled={!v.glass}
            hint="Valores mais altos deixam o topo mais sólido e legível."
            onChange={(n) => set("glassOpacity", n)}
          />
          <p className="text-xs text-muted-foreground">
            Respeitamos automaticamente quem usa “reduzir transparência” no sistema.
          </p>
        </Section>

        <Section title="Marca" description="Logo e banner exibidos na loja." icon={ImageIcon}>
          <div className="flex flex-col gap-1.5">
            <Label>URL do logo</Label>
            <Input
              value={v.logoUrl}
              onChange={(e) => set("logoUrl", e.target.value)}
              placeholder="/logo.png"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>URL do banner (opcional)</Label>
            <Input
              value={v.bannerUrl}
              onChange={(e) => set("bannerUrl", e.target.value)}
              placeholder="https://…/banner.jpg"
            />
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando..." : "Salvar e aplicar"}
          </Button>
          <Button variant="ghost" onClick={() => setV({ ...DEFAULT_VISUAL })} disabled={pending}>
            <RotateCcw /> Restaurar padrão
          </Button>
        </div>
      </div>

      {/* Coluna de preview */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <StorePreview v={v} />
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  icon,
  children,
}: { title: string; description?: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card>
      <CardIconHeader icon={icon} title={title} description={description} />
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function ColorControl({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-[10rem] font-mono uppercase"
          aria-label={`${label} (hex)`}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((c) => {
          const active = value.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`Usar ${c}`}
              aria-pressed={active}
              className={cn(
                "size-7 rounded-full border transition-transform hover:scale-110",
                active
                  ? "border-transparent ring-2 ring-ring ring-offset-2 ring-offset-background"
                  : "border-border",
              )}
              style={{ backgroundColor: c }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  hint,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={cn("flex flex-col gap-2", disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StorePreview({ v }: { v: Required<VisualSettings> }) {
  const style = themeVars(v) as unknown as CSSProperties;
  const logo = v.logoUrl?.trim() || "/logo.png";
  const banner = v.bannerUrl?.trim();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Pré-visualização</CardTitle>
        <span className="eyebrow">Loja</span>
      </CardHeader>
      <CardContent>
        <div
          style={style}
          className="overflow-hidden rounded-xl border border-border bg-background text-foreground"
        >
          {/* Banner com o topo em vidro por cima */}
          <div className="relative h-32">
            <div
              className="absolute inset-0"
              style={
                banner
                  ? { background: `center/cover no-repeat url(${JSON.stringify(banner)})` }
                  : { background: "linear-gradient(120deg, var(--primary), var(--accent))" }
              }
            />
            <div
              className="absolute inset-x-0 top-0 z-10 flex items-center justify-between border-b border-border/40 px-3 py-2"
              style={{
                backgroundColor: "var(--header-bg)",
                backdropFilter: "blur(var(--header-blur))",
                WebkitBackdropFilter: "blur(var(--header-blur))",
              }}
            >
              <img src={logo} alt="" className="h-5 w-auto dark:brightness-0 dark:invert" />
              <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-semibold text-primary-foreground">
                <ShoppingBag className="size-3" /> 3
              </span>
            </div>
          </div>

          {/* Grade de produtos */}
          <div className="grid grid-cols-2 gap-3 p-3">
            {[1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="aspect-square bg-muted" />
                <div className="flex flex-col gap-2 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">Produto {i}</span>
                    {i === 1 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.55rem] font-semibold text-accent-foreground">
                        Novo
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-semibold">R$ {i * 49},90</span>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="mt-0.5 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                  >
                    Comprar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Amostra ilustrativa do topo e de produtos com o tema atual.
        </p>
      </CardContent>
    </Card>
  );
}
