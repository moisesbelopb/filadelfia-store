import { cn } from "@/lib/utils";
import type { Category } from "@/types/db";
import Link from "next/link";

export function CategoryChips({
  categories,
  activeSlug,
  q,
}: {
  categories: Category[];
  activeSlug?: string;
  q?: string;
}) {
  const hrefFor = (slug?: string) => {
    const params = new URLSearchParams();
    if (slug) params.set("cat", slug);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Chip href={hrefFor()} active={!activeSlug}>
        Todos
      </Chip>
      {categories.map((c) => (
        <Chip key={c.id} href={hrefFor(c.slug)} active={activeSlug === c.slug}>
          {c.name}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </Link>
  );
}
