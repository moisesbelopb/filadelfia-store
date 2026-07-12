"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Nas páginas de checkout o rodapé de marketing atrapalha o CTA fixo
// ("Finalizar pedido" / "Enviar pedido") e gera rolagem extra. Ocultamos nelas.
const HIDE_ON = ["/carrinho", "/checkout"];

export function SiteFooter() {
  const pathname = usePathname();
  if (HIDE_ON.includes(pathname)) return null;

  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto grid max-w-[1600px] gap-8 px-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em]">
            Casa de Filadélfia
          </p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Coleção Multiplicação. Peça pelo celular, pague na entrega e acompanhe seu pedido.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">Comprar</p>
          <Link href="/?cat=feminino" className="text-muted-foreground hover:text-foreground">
            Feminino
          </Link>
          <Link href="/?cat=masculino" className="text-muted-foreground hover:text-foreground">
            Masculino
          </Link>
          <Link href="/?cat=infantil" className="text-muted-foreground hover:text-foreground">
            Infantil
          </Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="eyebrow">Ajuda</p>
          <Link href="/pedidos" className="text-muted-foreground hover:text-foreground">
            Meus pedidos
          </Link>
          <Link href="/conta" className="text-muted-foreground hover:text-foreground">
            Minha conta
          </Link>
          <Link href="/privacidade" className="text-muted-foreground hover:text-foreground">
            Política de privacidade
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-[1600px] flex-col items-center justify-between gap-2 border-t border-border px-4 pt-6 text-xs text-muted-foreground sm:flex-row">
        <p>© 2026 Solution Sistema. Todos os direitos reservados.</p>
        <p>
          Desenvolvido por{" "}
          <a
            href="https://www.solutionsistema.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground transition-colors hover:underline"
          >
            Solution Sistema
          </a>
        </p>
      </div>
    </footer>
  );
}
