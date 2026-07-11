"use client";

import { ProductThumb } from "@/components/loja/product-thumb";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface GalleryImage {
  path: string | null;
  alt: string | null;
}

/** Nível de ampliação da lupa (ao clicar, no desktop). */
const ZOOM = 2;
/** Intervalo do autoplay (ms). */
const INTERVAL = 4000;

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Galeria de produto:
 *  - Autoplay: as imagens passam sozinhas a cada alguns segundos (pausa no zoom).
 *  - Clique (desktop): ativa a lupa (zoom que segue o cursor); clicar de novo sai.
 *  - Miniaturas: selecionam a imagem manualmente.
 */
export function ProductGallery({ name, images }: { name: string; images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [canHover, setCanHover] = useState(false);
  const reduced = useRef(false);
  const main = images[active] ?? images[0];

  useEffect(() => {
    setCanHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Autoplay: passa as imagens sozinhas (pausa enquanto está com zoom).
  useEffect(() => {
    if (images.length <= 1 || zoomed || reduced.current) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [images.length, zoomed]);

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    });
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!canHover) return;
    if (!zoomed) {
      const rect = e.currentTarget.getBoundingClientRect();
      setOrigin({
        x: clamp(((e.clientX - rect.left) / rect.width) * 100),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100),
      });
    }
    setZoomed((z) => !z);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: lupa é aprimoramento só de mouse; teclado usa as miniaturas */}
      <div
        className={cn(
          "relative aspect-square select-none overflow-hidden rounded-md bg-secondary",
          canHover && (zoomed ? "cursor-zoom-out" : "cursor-zoom-in"),
        )}
        onMouseMove={canHover ? handleMove : undefined}
        onMouseLeave={() => setZoomed(false)}
        onClick={handleClick}
      >
        <div
          className="absolute inset-0 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            transform: zoomed ? `scale(${ZOOM})` : "scale(1)",
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        >
          <ProductThumb
            name={main?.alt ?? name}
            path={main?.path}
            sizes="(max-width: 1024px) 100vw, 1200px"
          />
        </div>
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.map((img, i) => (
            <button
              key={`${img.path}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Ver imagem ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border transition",
                i === active
                  ? "border-foreground"
                  : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <ProductThumb name={name} path={img.path} sizes="120px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
