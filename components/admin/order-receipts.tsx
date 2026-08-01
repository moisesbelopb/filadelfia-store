"use client";

import { deleteOrderReceipt, uploadOrderReceipt } from "@/actions/admin/receipts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RECEIPT_ACCEPT, prepareReceipt } from "@/lib/image/receipt";
import type { OrderReceipt } from "@/lib/queries/admin";
import { toast } from "@/lib/use-toast";
import { FileText, Trash2, Upload } from "lucide-react";
import { useRef, useTransition } from "react";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Comprovantes de pagamento do pedido: anexar (com compressão), ver e remover. */
export function OrderReceipts({
  orderId,
  receipts,
}: {
  orderId: string;
  receipts: OrderReceipt[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      const prepared = await prepareReceipt(file); // valida e comprime >3MB no navegador
      if (!prepared.ok) {
        toast({ variant: "error", title: "Arquivo inválido", description: prepared.error });
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      const fd = new FormData();
      fd.set("file", prepared.file);
      const res = await uploadOrderReceipt(orderId, fd);
      toast(
        res.ok
          ? { variant: "success", title: "Comprovante anexado" }
          : { variant: "error", title: "Falha no anexo", description: res.error },
      );
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove(name: string) {
    startTransition(async () => {
      const res = await deleteOrderReceipt(orderId, name);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
      else toast({ variant: "success", title: "Comprovante removido" });
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Comprovantes de pagamento</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" /> {pending ? "Enviando..." : "Anexar"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {receipts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comprovante anexado ainda.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {receipts.map((r) => (
              <div
                key={r.name}
                className="group relative overflow-hidden rounded-lg border border-border"
              >
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="block">
                  {r.isPdf ? (
                    <div className="flex aspect-square flex-col items-center justify-center gap-1 bg-secondary/40 text-muted-foreground">
                      <FileText className="size-8" />
                      <span className="text-xs font-medium">PDF</span>
                    </div>
                  ) : (
                    <img
                      src={r.url}
                      alt="Comprovante de pagamento"
                      loading="lazy"
                      className="aspect-square w-full bg-secondary/40 object-cover"
                    />
                  )}
                </a>
                <div className="flex items-center justify-between gap-1 px-2 py-1 text-[0.65rem] text-muted-foreground">
                  <span className="tabular-nums">{fmtSize(r.size)}</span>
                  <button
                    type="button"
                    onClick={() => remove(r.name)}
                    disabled={pending}
                    className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    aria-label="Remover comprovante"
                    title="Remover"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={RECEIPT_ACCEPT}
          className="hidden"
          onChange={onFile}
        />
        <p className="text-xs text-muted-foreground">
          Imagem (JPG, PNG, WebP) ou PDF, até <strong>3 MB</strong>. Imagens maiores são{" "}
          <strong>compactadas automaticamente</strong> antes de anexar.
        </p>
      </CardContent>
    </Card>
  );
}
