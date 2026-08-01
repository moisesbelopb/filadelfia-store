"use client";

import { deleteOrderReceipt, uploadOrderReceipt } from "@/actions/admin/receipts";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RECEIPT_ACCEPT, prepareReceipt } from "@/lib/image/receipt";
import type { OrderReceipt } from "@/lib/queries/admin";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { useTransition } from "react";

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Comprovantes de pagamento do pedido: anexar (vários, com compressão), ver e excluir. */
export function OrderReceipts({
  orderId,
  receipts,
}: {
  orderId: string;
  receipts: OrderReceipt[];
}) {
  const [pending, startTransition] = useTransition();

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;
    startTransition(async () => {
      let done = 0;
      const errors: string[] = [];
      for (const file of files) {
        const prepared = await prepareReceipt(file); // valida e comprime >3MB no navegador
        if (!prepared.ok) {
          errors.push(prepared.error);
          continue;
        }
        const fd = new FormData();
        fd.set("file", prepared.file);
        const res = await uploadOrderReceipt(orderId, fd);
        if (res.ok) done += 1;
        else errors.push(res.error ?? "Falha no envio.");
      }
      if (done > 0) {
        toast({
          variant: "success",
          title: `${done} comprovante${done > 1 ? "s" : ""} anexado${done > 1 ? "s" : ""}`,
        });
      }
      if (errors.length > 0) {
        toast({
          variant: "error",
          title: `${errors.length} não anexado${errors.length > 1 ? "s" : ""}`,
          description: errors[0],
        });
      }
      input.value = "";
    });
  }

  function remove(name: string) {
    startTransition(async () => {
      const res = await deleteOrderReceipt(orderId, name);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
      else toast({ variant: "success", title: "Comprovante excluído" });
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Comprovantes de pagamento</CardTitle>
        {/* Label nativo (não JS .click): abre o seletor na hora pelo gesto do clique. */}
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer",
            pending && "pointer-events-none opacity-60",
          )}
        >
          <Upload className="size-4" /> {pending ? "Enviando..." : "Anexar"}
          <input
            type="file"
            accept={RECEIPT_ACCEPT}
            multiple
            className="sr-only"
            onChange={onFiles}
            disabled={pending}
          />
        </label>
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

                {/* Excluir — visível, no canto superior. */}
                <button
                  type="button"
                  onClick={() => remove(r.name)}
                  disabled={pending}
                  className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm backdrop-blur transition-colors hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40"
                  aria-label="Excluir comprovante"
                  title="Excluir comprovante"
                >
                  <Trash2 className="size-4" />
                </button>

                <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[0.7rem] text-muted-foreground">
                  <span className="tabular-nums">{fmtSize(r.size)}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                  >
                    Ver <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Você pode anexar <strong>vários arquivos</strong> (imagem JPG/PNG/WebP ou PDF), até{" "}
          <strong>3 MB</strong> cada. Imagens maiores são{" "}
          <strong>compactadas automaticamente</strong>.
        </p>
      </CardContent>
    </Card>
  );
}
