"use client";

import {
  createCategory,
  deleteCategory,
  reorderCategory,
  updateCategory,
} from "@/actions/admin/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CategoryWithCount } from "@/lib/queries/admin";
import { toast } from "@/lib/use-toast";
import { cardHighlight, cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CategoriesManager({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okTitle?: string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      if (okTitle) toast({ variant: "success", title: okTitle });
      router.refresh();
    });
  }

  function create() {
    const name = newName.trim();
    if (name.length < 2) {
      toast({ variant: "error", title: "Nome muito curto" });
      return;
    }
    startTransition(async () => {
      const res = await createCategory({ name });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      setNewName("");
      toast({ variant: "success", title: "Categoria criada" });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-end gap-2 p-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="new-cat" className="text-sm font-medium">
              Nova categoria
            </label>
            <Input
              id="new-cat"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Feminino, Infantil…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
            />
          </div>
          <Button onClick={create} disabled={pending} className="shrink-0">
            <Plus className="size-4" /> Criar
          </Button>
        </CardContent>
      </Card>

      {categories.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhuma categoria ainda. Crie a primeira acima.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c, i) => (
            <CategoryRow
              key={c.id}
              category={c}
              isFirst={i === 0}
              isLast={i === categories.length - 1}
              pending={pending}
              run={run}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  isFirst,
  isLast,
  pending,
  run,
}: {
  category: CategoryWithCount;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okTitle?: string) => void;
}) {
  const [name, setName] = useState(category.name);
  const dirty = name.trim() !== category.name && name.trim().length >= 2;

  return (
    <li>
      <Card className={cardHighlight}>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              disabled={isFirst || pending}
              onClick={() => run(() => reorderCategory(category.id, "up"))}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              aria-label="Mover para cima"
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              disabled={isLast || pending}
              onClick={() => run(() => reorderCategory(category.id, "down"))}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
              aria-label="Mover para baixo"
            >
              <ArrowDown className="size-4" />
            </button>
          </div>

          <div className="flex min-w-[10rem] flex-1 items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={cn("h-9", !category.is_active && "text-muted-foreground")}
            />
            {dirty && (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => run(() => updateCategory(category.id, { name }), "Categoria salva")}
                className="shrink-0"
              >
                <Check className="size-4" />
              </Button>
            )}
          </div>

          <span className="shrink-0 text-xs text-muted-foreground">
            {category.productCount} {category.productCount === 1 ? "produto" : "produtos"}
          </span>

          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={category.is_active}
              disabled={pending}
              onCheckedChange={(v) =>
                run(
                  () => updateCategory(category.id, { isActive: v }),
                  v ? "Categoria ativada" : "Categoria oculta",
                )
              }
              aria-label={category.is_active ? "Desativar categoria" : "Ativar categoria"}
            />
            {category.is_active ? "Ativa" : "Oculta"}
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `Excluir a categoria "${category.name}"? Os produtos ficam sem categoria (não são apagados).`,
                )
              ) {
                run(() => deleteCategory(category.id), "Categoria excluída");
              }
            }}
            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
            aria-label={`Excluir ${category.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        </CardContent>
      </Card>
    </li>
  );
}
