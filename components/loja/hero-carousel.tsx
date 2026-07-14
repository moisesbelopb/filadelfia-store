"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export interface HeroSlide {
  src: string;
  alt: string;
  /** Posição do foco da imagem (object-position). */
  focus?: string;
}

/**
 * Carrossel do hero: troca de imagens com fade, autoplay pausável e acessível.
 * Respeita prefers-reduced-motion (não faz autoplay) e o conteúdo (texto/CTA)
 * fica fixo sobre as imagens.
 */
export function HeroCarousel({
  slides,
  children,
  interval = 5000,
}: {
  slides: HeroSlide[];
  children: React.ReactNode;
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  /**
   * Só monta a imagem do slide atual, do próximo (pré-carregado para o fade não
   * piscar) e dos que já foram vistos. Antes, as 5 <Image> nasciam juntas dentro
   * da viewport — o lazy loading do next/image não segurava nenhuma, e a home
   * baixava as 5 fotos do hero no primeiro paint.
   */
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0, 1 % Math.max(count, 1)]));
  useEffect(() => {
    setMounted((prev) => {
      const next = (index + 1) % count;
      if (prev.has(index) && prev.has(next)) return prev;
      const s = new Set(prev);
      s.add(index);
      s.add(next);
      return s;
    });
  }, [index, count]);

  // Autoplay — pausa em hover/foco e quando o usuário prefere menos movimento.
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (count <= 1 || paused || reduced.current) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => window.clearInterval(id);
  }, [count, paused, interval]);

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-secondary"
      aria-roledescription="carrossel"
      aria-label="Coleção Multiplicação"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="relative h-[42vh] min-h-[300px] w-full sm:h-[62vh] lg:h-[72vh] lg:max-h-[680px]">
        {slides.map((slide, i) => (
          <div
            key={slide.src}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-out motion-reduce:transition-none",
              i === index ? "opacity-100" : "opacity-0",
            )}
            aria-hidden={i !== index}
          >
            {mounted.has(i) && (
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="100vw"
                quality={82}
                className="object-cover"
                style={{ objectPosition: slide.focus ?? "center 25%" }}
              />
            )}
          </div>
        ))}

        {/* Camada de escurecimento para contraste do texto. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/75 sm:via-black/35 sm:to-transparent" />

        {/* Conteúdo fixo. */}
        <div className="absolute inset-0 flex items-end sm:items-center">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-12 sm:pb-0">{children}</div>
        </div>

        {/* Controles. */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 sm:flex"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30 sm:flex"
            >
              <ChevronRight className="size-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((slide, i) => (
                <button
                  key={slide.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Ir para a imagem ${i + 1}`}
                  aria-current={i === index}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
