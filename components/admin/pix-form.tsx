"use client";

import { saveMessageTemplate, savePixSettings } from "@/actions/admin/settings";
import { CardIconHeader } from "@/components/admin/card-icon-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PIX_MESSAGE } from "@/lib/orders/template";
import { toast } from "@/lib/use-toast";
import type { MessageTemplate, PixSettings } from "@/types/db";
import { Banknote, MessageCircle, MessageSquareText, Plus, RotateCcw } from "lucide-react";
import { useRef, useState, useTransition } from "react";

/** Variáveis disponíveis (viram botões que inserem o token no texto). */
const VARIABLES: { token: string; label: string }[] = [
  { token: "{{cliente}}", label: "Cliente" },
  { token: "{{pedido}}", label: "Nº do pedido" },
  { token: "{{valor}}", label: "Valor" },
  { token: "{{chave_pix}}", label: "Chave Pix" },
  { token: "{{recebedor}}", label: "Recebedor" },
  { token: "{{itens}}", label: "Itens" },
];

export function PixForm({
  pix,
  template,
}: {
  pix: PixSettings | null;
  template: MessageTemplate | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PixSettingsCard pix={pix} />
      <TemplateCard template={template} />
    </div>
  );
}

function PixSettingsCard({ pix }: { pix: PixSettings | null }) {
  const [form, setForm] = useState<PixSettings>({
    chave: pix?.chave ?? "",
    recebedor: pix?.recebedor ?? "",
    banco: pix?.banco ?? "",
    observacao: pix?.observacao ?? "",
    whatsapp_loja: pix?.whatsapp_loja ?? "",
  });
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await savePixSettings(form);
      toast(
        res.ok
          ? { variant: "success", title: "Dados de Pix salvos" }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  return (
    <Card>
      <CardIconHeader
        icon={Banknote}
        title="Recebimento por Pix"
        description="A chave e o recebedor entram no e-mail de confirmação de pedidos Pix."
      />
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Chave Pix</Label>
          <Input
            value={form.chave}
            onChange={(e) => setForm({ ...form, chave: e.target.value })}
            placeholder="e-mail, telefone, CPF/CNPJ ou aleatória"
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nome do recebedor</Label>
          <Input
            value={form.recebedor}
            onChange={(e) => setForm({ ...form, recebedor: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Banco (opcional)</Label>
          <Input
            value={form.banco ?? ""}
            onChange={(e) => setForm({ ...form, banco: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3 pt-1 sm:col-span-2">
          <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Comprovante pelo WhatsApp
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>WhatsApp da loja</Label>
          <Input
            value={form.whatsapp_loja ?? ""}
            onChange={(e) => setForm({ ...form, whatsapp_loja: e.target.value })}
            placeholder="(11) 99999-9999"
            inputMode="tel"
          />
          <p className="text-xs text-muted-foreground">
            Vira o botão “Enviar comprovante pelo WhatsApp” no e-mail de confirmação.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label>Observação interna (opcional)</Label>
          <Input
            value={form.observacao ?? ""}
            onChange={(e) => setForm({ ...form, observacao: e.target.value })}
          />
        </div>

        <div className="sm:col-span-2">
          <Button onClick={save} disabled={pending || !form.chave || !form.recebedor}>
            {pending ? "Salvando..." : "Salvar dados de Pix"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateCard({ template }: { template: MessageTemplate | null }) {
  // Sem template salvo (ex.: modo demo), começa com a mensagem padrão editável.
  const [body, setBody] = useState(template?.body || DEFAULT_PIX_MESSAGE);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(token: string) {
    const el = textareaRef.current;
    if (!el) {
      setBody((b) => `${b}${token}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBody((b) => b.slice(0, start) + token + b.slice(end));
    // Recoloca o cursor logo após o token inserido.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveMessageTemplate({
        key: "pix",
        name: template?.name ?? "Mensagem Pix",
        body,
      });
      toast(
        res.ok
          ? { variant: "success", title: "Template salvo" }
          : { variant: "error", title: "Erro", description: res.error },
      );
    });
  }

  return (
    <Card>
      <CardIconHeader
        icon={MessageSquareText}
        title="Mensagem de cobrança (WhatsApp)"
        description="Texto pré-preenchido quando você clica em “Falar no WhatsApp” na tela do pedido."
      />
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Clique para inserir uma variável:</p>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                // Evita que o textarea perca o cursor ao clicar no botão.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVariable(v.token)}
                title={`Inserir ${v.token}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:border-foreground/30 hover:bg-secondary/70"
              >
                <Plus className="size-3" /> {v.label}
              </button>
            ))}
          </div>
        </div>

        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={pending || !body.trim()} className="w-fit">
            {pending ? "Salvando..." : "Salvar mensagem"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBody(DEFAULT_PIX_MESSAGE)}
            disabled={pending || body === DEFAULT_PIX_MESSAGE}
          >
            <RotateCcw className="size-3.5" /> Restaurar padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
