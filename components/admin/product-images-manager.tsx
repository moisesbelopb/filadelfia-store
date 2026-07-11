"use client";

import {
  deleteProductImage,
  setHoverImage,
  setPrimaryImage,
  uploadProductImage,
} from "@/actions/admin/products";
import { ProductThumb } from "@/components/loja/product-thumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/db";
import { ImagePlus, MousePointer2, Star, Trash2 } from "lucide-react";
import { useRef, useTransition } from "react";

export function ProductImagesManager({
  productId,
  images,
  productName,
}: {
  productId: string;
  images: ProductImage[];
  productName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadProductImage(productId, fd);
      if (!res.ok) toast({ variant: "error", title: "Falha no upload", description: res.error });
      else toast({ variant: "success", title: "Imagem enviada" });
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteProductImage(id, productId);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
    });
  }

  function makePrimary(id: string) {
    startTransition(async () => {
      const res = await setPrimaryImage(id, productId);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
      else toast({ variant: "success", title: "Imagem principal atualizada" });
    });
  }

  function makeHover(id: string) {
    startTransition(async () => {
      const res = await setHoverImage(id, productId);
      if (!res.ok) toast({ variant: "error", title: "Erro", description: res.error });
      else toast({ variant: "success", title: "Foto alternativa atualizada" });
    });
  }

  // Espelha a lógica do card da loja: principal em repouso; a próxima (por
  // ordem recebida) é a que aparece no hover.
  const primaryId = images.find((i) => i.is_primary)?.id ?? images[0]?.id;
  const hoverId = images.find((i) => i.id !== primaryId)?.id;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fotos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((img) => {
            const isPrimary = img.id === primaryId;
            const isHover = img.id === hoverId;
            return (
              <div
                key={img.id}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-lg border",
                  isPrimary
                    ? "border-primary ring-2 ring-primary"
                    : isHover
                      ? "border-foreground/40"
                      : "border-border",
                )}
              >
                <ProductThumb
                  name={productName}
                  path={img.storage_path}
                  sizes="(max-width: 640px) 50vw, 33vw"
                />

                {/* Rótulos do papel da foto na loja. */}
                {(isPrimary || isHover) && (
                  <span
                    className={cn(
                      "absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em]",
                      isPrimary
                        ? "bg-primary text-primary-foreground"
                        : "bg-background/85 text-foreground backdrop-blur",
                    )}
                  >
                    {isPrimary ? (
                      <Star className="size-3 fill-current" />
                    ) : (
                      <MousePointer2 className="size-3" />
                    )}
                    {isPrimary ? "Principal" : "Foto alternativa"}
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => makePrimary(img.id)}
                    disabled={pending || isPrimary}
                    className="text-white disabled:opacity-40"
                    aria-label="Tornar principal (foto em repouso)"
                    title="Tornar principal"
                  >
                    <Star className={cn("size-4", isPrimary && "fill-warning text-warning")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => makeHover(img.id)}
                    disabled={pending || isPrimary || isHover}
                    className="text-white disabled:opacity-40"
                    aria-label="Usar como foto alternativa"
                    title="Foto alternativa (aparece ao passar o mouse no card)"
                  >
                    <MousePointer2 className={cn("size-4", isHover && "text-warning")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(img.id)}
                    disabled={pending}
                    className="text-white hover:text-destructive"
                    aria-label="Remover imagem"
                    title="Remover"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:bg-secondary"
          >
            <ImagePlus className="size-6" />
            <span className="text-xs">Adicionar</span>
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <p className="text-xs text-muted-foreground">
          JPG/PNG até 5 MB. Passe o mouse na foto para as ações:{" "}
          <Star className="inline size-3 align-[-2px]" /> define a <strong>principal</strong> (foto
          em repouso) e <MousePointer2 className="inline size-3 align-[-2px]" /> define a{" "}
          <strong>foto alternativa</strong> (aparece ao passar o mouse no card da loja).
        </p>
      </CardContent>
    </Card>
  );
}
