"use client";

import { createCategory } from "@/actions/admin/categories";
import { createProduct, updateProduct } from "@/actions/admin/products";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/use-toast";
import { type ProductInput, productSchema } from "@/lib/validators/admin";
import type { Category, ProductWithImages } from "@/types/db";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";

export function ProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: ProductWithImages;
}) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [cats, setCats] = useState<Category[]>(categories);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      categoryId: product?.category_id ?? null,
      descriptionShort: product?.description_short ?? "",
      descriptionLong: product?.description_long ?? "",
      price: product?.price ?? 0,
      colorName: product?.color_name ?? "",
      colorHex: product?.color_hex ?? "",
      colorGroup: product?.color_group ?? "",
      isActive: product?.is_active ?? true,
      isFeatured: product?.is_featured ?? false,
    },
  });

  const colorHex = watch("colorHex") ?? "";

  async function onSubmit(values: ProductInput) {
    if (product) {
      const res = await updateProduct(product.id, values);
      if (!res.ok) {
        toast({ variant: "error", title: "Erro ao salvar", description: res.error });
        return;
      }
      toast({ variant: "success", title: "Produto atualizado" });
      router.refresh();
      return;
    }

    const res = await createProduct(values);
    if (!res.ok) {
      toast({ variant: "error", title: "Erro ao salvar", description: res.error });
      return;
    }
    toast({ variant: "success", title: "Produto criado" });
    router.push(`/admin/produtos/${res.data.id}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados do produto</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome" error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
          </div>

          <CategoryField
            categories={cats}
            error={errors.categoryId?.message}
            register={register("categoryId")}
            onCreated={(c) => {
              setCats((prev) => [...prev, c]);
              setValue("categoryId", c.id, { shouldValidate: true });
            }}
          />

          <Field label="Preço (R$)" error={errors.price?.message}>
            <Input type="number" step="0.01" min="0" {...register("price")} />
          </Field>

          {/* Cor — alimenta o seletor de cores da loja. */}
          <div className="sm:col-span-2 grid gap-4 rounded-lg border border-border bg-secondary/30 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2 -mb-1">
              <p className="text-sm font-medium">Cor deste produto</p>
              <p className="text-xs text-muted-foreground">
                Produtos com o <strong>mesmo grupo de cor</strong> viram opções de cor na loja (cada
                cor tem suas próprias fotos). Sem grupo, a loja agrupa pela categoria.
              </p>
            </div>
            <Field label="Nome da cor" error={errors.colorName?.message}>
              <Input {...register("colorName")} placeholder="Off-White, Preta…" />
            </Field>
            <Field label="Cor (swatch)" error={errors.colorHex?.message}>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Selecionar cor"
                  value={/^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : "#cccccc"}
                  onChange={(e) => setValue("colorHex", e.target.value, { shouldValidate: true })}
                  className="size-11 shrink-0 cursor-pointer rounded-md border border-input bg-transparent"
                />
                <Input {...register("colorHex")} placeholder="#161616" className="font-mono" />
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Grupo de cor (opcional)" error={errors.colorGroup?.message}>
                <Input
                  {...register("colorGroup")}
                  placeholder="ex.: camiseta-multiplicacao-feminino"
                />
                <p className="text-xs text-muted-foreground">
                  Use o mesmo texto nas peças que são a{" "}
                  <strong>mesma roupa em cores diferentes</strong>.
                </p>
              </Field>
            </div>
          </div>

          <div className="sm:col-span-2">
            <Field label="Descrição curta" error={errors.descriptionShort?.message}>
              <Input {...register("descriptionShort")} maxLength={160} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descrição completa" error={errors.descriptionLong?.message}>
              <Textarea {...register("descriptionLong")} rows={4} />
            </Field>
          </div>

          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isActive")} className="size-4" /> Ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("isFeatured")} className="size-4" /> Destaque
            </label>
          </div>

          {!isEdit && (
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Depois de criar, você define os <strong>tamanhos e o estoque</strong> e adiciona as{" "}
              <strong>fotos</strong> na tela de edição.
            </p>
          )}

          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar produto"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Select de categoria com criação inline (+ Nova categoria). */
function CategoryField({
  categories,
  error,
  register,
  onCreated,
}: {
  categories: Category[];
  error?: string;
  register: UseFormRegisterReturn;
  onCreated: (c: Category) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    const value = name.trim();
    if (value.length < 2) {
      toast({ variant: "error", title: "Nome muito curto" });
      return;
    }
    startTransition(async () => {
      const res = await createCategory({ name: value });
      if (!res.ok) {
        toast({ variant: "error", title: "Erro", description: res.error });
        return;
      }
      onCreated({
        id: res.data.id,
        name: res.data.name,
        slug: res.data.slug,
        position: categories.length,
        is_active: true,
        created_at: new Date(0).toISOString(),
      });
      toast({ variant: "success", title: "Categoria criada" });
      setName("");
      setAdding(false);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>Categoria</Label>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {adding ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {adding ? "Cancelar" : "Nova categoria"}
        </button>
      </div>

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
          />
          <Button type="button" onClick={create} disabled={pending} size="sm" className="shrink-0">
            {pending ? "..." : <Check className="size-4" />}
          </Button>
        </div>
      ) : (
        <Select {...register}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
