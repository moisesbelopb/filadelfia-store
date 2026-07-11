import { productImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import Image from "next/image";

/** Miniatura do produto: imagem do Storage ou placeholder com a inicial. */
export function ProductThumb({
  name,
  path,
  sizes = "(max-width: 640px) 50vw, 300px",
  className,
  fit = "cover",
}: {
  name: string;
  path?: string | null;
  sizes?: string;
  className?: string;
  /** object-fit: "cover" recorta para preencher; "contain" mostra a foto inteira. */
  fit?: "cover" | "contain";
}) {
  const url = productImageUrl(path);
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        fill
        sizes={sizes}
        quality={90}
        className={cn(fit === "contain" ? "object-contain" : "object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn("flex h-full w-full items-center justify-center bg-secondary", className)}
      aria-hidden
    >
      <span className="font-display text-4xl font-semibold uppercase text-muted-foreground/50">
        {name.charAt(0)}
      </span>
    </div>
  );
}
