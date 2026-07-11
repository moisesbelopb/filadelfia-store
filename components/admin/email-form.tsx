"use client";

import { saveEmailSettings } from "@/actions/admin/settings";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_EMAILS, EMAIL_EVENTS } from "@/lib/email/defaults";
import { renderTemplate } from "@/lib/orders/template";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import type { EmailSettings, EmailTemplate } from "@/types/db";
import { BadgeCheck, Inbox, type LucideIcon, PackageCheck, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";

/** Ícone + tom de cor por e-mail (o "entregue" herda o verde do e-mail real). */
const META: Record<keyof EmailSettings, { icon: LucideIcon; tone: string }> = {
  order_placed: { icon: Inbox, tone: "text-muted-foreground" },
  order_accepted: { icon: BadgeCheck, tone: "text-foreground" },
  order_delivered: { icon: PackageCheck, tone: "text-success" },
};

/** Dados de exemplo só para a prévia do assunto. */
const PREVIEW_VARS = { cliente: "Maria", pedido: "1024" };

/** Preenche os campos com o que está salvo, caindo no padrão quando faltar. */
function withDefaults(email: EmailSettings | null): EmailSettings {
  return {
    order_placed: { ...DEFAULT_EMAILS.order_placed, ...(email?.order_placed ?? {}) },
    order_accepted: { ...DEFAULT_EMAILS.order_accepted, ...(email?.order_accepted ?? {}) },
    order_delivered: { ...DEFAULT_EMAILS.order_delivered, ...(email?.order_delivered ?? {}) },
  };
}

export function EmailForm({ email }: { email: EmailSettings | null }) {
  const [form, setForm] = useState<EmailSettings>(() => withDefaults(email));
  const [selected, setSelected] = useState<keyof EmailSettings>("order_placed");
  const [pending, startTransition] = useTransition();

  const active = EMAIL_EVENTS.find((e) => e.key === selected) ?? EMAIL_EVENTS[0];
  const t = form[selected];
  const ActiveIcon = META[selected].icon;

  function update(field: keyof EmailTemplate, value: string) {
    setForm((f) => ({ ...f, [selected]: { ...f[selected], [field]: value } }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveEmailSettings(form);
      toast(
        res.ok
          ? { variant: "success", title: "E-mails salvos" }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* Navegador dos e-mails: lista vertical no desktop, rolagem no mobile. */}
        <nav
          aria-label="E-mails do pedido"
          className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {EMAIL_EVENTS.map((evt) => {
            const Icon = META[evt.key].icon;
            const isSel = evt.key === selected;
            return (
              <button
                key={evt.key}
                type="button"
                aria-pressed={isSel}
                onClick={() => setSelected(evt.key)}
                className={cn(
                  "flex min-w-[190px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors lg:min-w-0",
                  isSel
                    ? "border-foreground/20 bg-secondary"
                    : "border-border hover:bg-secondary/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md bg-background",
                    META[evt.key].tone,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{evt.label}</span>
                  <span className="truncate text-xs text-muted-foreground">{evt.short}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Editor do e-mail selecionado. */}
        <Card>
          <CardIconHeader
            icon={ActiveIcon}
            title={active.label}
            description={active.desc}
            iconClassName={META[selected].tone}
          />
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Assunto</Label>
              <Input value={t.subject} onChange={(e) => update("subject", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Prévia:{" "}
                <span className="text-foreground">{renderTemplate(t.subject, PREVIEW_VARS)}</span>
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Título (dentro do e-mail)</Label>
              <Input value={t.heading} onChange={(e) => update("heading", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mensagem</Label>
              <Textarea
                value={t.intro}
                onChange={(e) => update("intro", e.target.value)}
                rows={5}
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Variáveis:{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                {"{{cliente}}"}
              </code>{" "}
              <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[0.7rem]">
                {"{{pedido}}"}
              </code>
              {selected === "order_accepted" &&
                " · Pedidos Pix ganham a chave e o botão de comprovante automaticamente."}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de ações — vale para os três e-mails. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <p className="text-xs text-muted-foreground">As alterações valem para os três e-mails.</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setForm(withDefaults(null))}
          >
            <RotateCcw className="size-3.5" /> Restaurar padrão
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? "Salvando..." : "Salvar e-mails"}
          </Button>
        </div>
      </div>
    </div>
  );
}
