"use client";

import {
  deleteProductImage,
  reorderProductImages,
  setHoverImage,
  setPrimaryImage,
  uploadProductImage,
} from "@/actions/admin/products";
import { ProductThumb } from "@/components/loja/product-thumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { compressProductImage } from "@/lib/image/compress";
import { ACCEPTED_IMAGE_LABEL, IMAGE_MAX_DIMENSION } from "@/lib/image/criteria";
import { toast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/types/db";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, MousePointer2, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

/** Uma foto arrastável do grid. O arrasto sai só da alça (grip). */
function SortableImageTile({
  img,
  productName,
  isPrimary,
  isHover,
  pending,
  onPrimary,
  onHover,
  onRemove,
}: {
  img: ProductImage;
  productName: string;
  isPrimary: boolean;
  isHover: boolean;
  pending: boolean;
  onPrimary: () => void;
  onHover: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border",
        isDragging && "opacity-70 shadow-lg",
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

      {/* Rótulo do papel da foto na loja. */}
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

      {/* Alça de arrasto: só ela captura o toque (touch-none), então a página
          continua rolando normalmente ao tocar no resto da foto. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute right-1.5 top-1.5 inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-background/85 text-foreground shadow-sm backdrop-blur active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
        title="Arraste para reordenar"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onPrimary}
          disabled={pending || isPrimary}
          className="text-white disabled:opacity-40"
          aria-label="Tornar principal (foto em repouso)"
          title="Tornar principal"
        >
          <Star className={cn("size-4", isPrimary && "fill-warning text-warning")} />
        </button>
        <button
          type="button"
          onClick={onHover}
          disabled={pending || isPrimary || isHover}
          className="text-white disabled:opacity-40"
          aria-label="Usar como foto alternativa"
          title="Foto alternativa (aparece ao passar o mouse no card)"
        >
          <MousePointer2 className={cn("size-4", isHover && "text-warning")} />
        </button>
        <button
          type="button"
          onClick={onRemove}
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
}

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

  // Ordem exibida = por `position` (a mesma que ordena a galeria na loja).
  const sorted = useMemo(
    () =>
      [...images].sort(
        (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
      ),
    [images],
  );
  const [order, setOrder] = useState<ProductImage[]>(sorted);
  // Ressincroniza quando as fotos do servidor mudam (upload, exclusão, reorder salvo).
  useEffect(() => {
    setOrder(sorted);
  }, [sorted]);

  const sensors = useSensors(
    // distance:6 => um clique (sem mover) aciona os botões; só arrasta ao mover.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Espelha a loja: principal em repouso; a próxima (por ordem) aparece no hover.
  const primaryId = order.find((i) => i.is_primary)?.id ?? order[0]?.id;
  const hoverId = order.find((i) => i.id !== primaryId)?.id;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    startTransition(async () => {
      // Converte para WebP e reduz no navegador antes de subir (arquivo leve).
      const prepared = await compressProductImage(file);
      if (!prepared.ok) {
        toast({ variant: "error", title: "Imagem inválida", description: prepared.error });
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      const fd = new FormData();
      fd.set("file", prepared.file);
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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => i.id === active.id);
    const newIndex = order.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prev = order;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next); // otimista: a UI reordena na hora
    startTransition(async () => {
      const res = await reorderProductImages(
        productId,
        next.map((i) => i.id),
      );
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível reordenar", description: res.error });
        setOrder(prev); // desfaz se o servidor recusar
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fotos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <SortableContext items={order.map((i) => i.id)} strategy={rectSortingStrategy}>
              {order.map((img) => (
                <SortableImageTile
                  key={img.id}
                  img={img}
                  productName={productName}
                  isPrimary={img.id === primaryId}
                  isHover={img.id === hoverId}
                  pending={pending}
                  onPrimary={() => makePrimary(img.id)}
                  onHover={() => makeHover(img.id)}
                  onRemove={() => remove(img.id)}
                />
              ))}
            </SortableContext>

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
        </DndContext>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFile}
        />
        <p className="text-xs text-muted-foreground">
          Arraste pela alça <GripVertical className="inline size-3 align-[-2px]" /> para{" "}
          <strong>reordenar</strong> as fotos — a ordem vale para a galeria do produto na loja.
        </p>
        <p className="text-xs text-muted-foreground">
          {ACCEPTED_IMAGE_LABEL}. Convertemos para <strong>WebP</strong> e reduzimos para no máx.{" "}
          {IMAGE_MAX_DIMENSION}px automaticamente — a foto fica leve sem perder qualidade. Melhor
          resultado: fotos nítidas, de preferência em pé (proporção 4:5).
        </p>
        <p className="text-xs text-muted-foreground">
          Passe o mouse na foto para as ações: <Star className="inline size-3 align-[-2px]" />{" "}
          define a <strong>principal</strong> (foto em repouso) e{" "}
          <MousePointer2 className="inline size-3 align-[-2px]" /> define a{" "}
          <strong>foto alternativa</strong> (aparece ao passar o mouse no card da loja).
        </p>
      </CardContent>
    </Card>
  );
}
