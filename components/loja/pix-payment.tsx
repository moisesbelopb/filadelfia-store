"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

/**
 * Bloco de pagamento Pix na tela do pedido do cliente. Mostra a chave com botão
 * de copiar e o botão que abre o WhatsApp da loja com a mensagem do comprovante
 * já preenchida. Aparece só em pedidos Pix ainda pendentes.
 */
export function PixPayment({
  chave,
  recebedor,
  valor,
  waHref,
}: {
  chave: string;
  recebedor: string;
  valor: string;
  waHref: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(chave);
    } catch {
      // Navegador sem permissão de clipboard: o cliente ainda pode selecionar a
      // chave manualmente no campo abaixo.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="text-base">💳 Pague com Pix e envie o comprovante</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Chave Pix</span>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {chave}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyKey}
              aria-label="Copiar chave Pix"
              className="shrink-0"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 text-muted-foreground">
          <p>
            👤 Recebedor: <span className="text-foreground">{recebedor}</span>
          </p>
          <p>
            💰 Valor: <span className="font-semibold text-foreground">{valor}</span>
          </p>
        </div>

        <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
          <li>Faça o Pix usando a chave acima.</li>
          <li>Toque no botão e envie o comprovante no WhatsApp da loja.</li>
        </ol>

        <Button asChild variant="success" size="lg" className="w-full">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> Enviar comprovante no WhatsApp
          </a>
        </Button>

        <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
          ⚠ Seu pedido só é confirmado após a equipe conferir o comprovante do Pix.
        </p>
      </CardContent>
    </Card>
  );
}
