import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { Share2 } from "lucide-react";

/** Botão que abre o WhatsApp com o texto já preenchido (compartilhar/indicar). */
export function WhatsappShare({
  text,
  label = "Compartilhar no WhatsApp",
  variant = "outline",
  className,
}: {
  text: string;
  label?: string;
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <Button asChild variant={variant} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Share2 className="size-4" /> {label}
      </a>
    </Button>
  );
}
