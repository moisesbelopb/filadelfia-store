"use client";

import { UserActions } from "@/components/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CustomerRow } from "@/lib/queries/admin";
import { cn, formatBRL, maskPhone } from "@/lib/utils";
import { CalendarDays, Mail, MapPin, Phone, Search, ShoppingBag } from "lucide-react";
import type { ElementType } from "react";
import { useMemo, useState } from "react";

/** Iniciais para o avatar (usa o nome; na falta, o e-mail). */
function initials(name: string | null, email: string): string {
  const src = (name ?? email).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

/** Endereço completo em uma linha legível. */
function formatAddress(a: CustomerRow["address"]): string | null {
  if (!a) return null;
  const parts = [
    [a.street, a.number].filter(Boolean).join(", "),
    a.complement,
    a.neighborhood,
    [a.city, a.state].filter(Boolean).join(" - "),
    a.zip,
  ].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(" · ") : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CustomersList({ customers }: { customers: CustomerRow[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((c) =>
      [c.full_name, c.email, c.whatsapp, c.address?.city, c.address?.neighborhood]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [customers, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, e-mail, WhatsApp ou cidade…"
          className="pl-9"
          aria-label="Buscar cliente"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {customers.length === 0
            ? "Nenhum cliente criou conta na loja ainda."
            : "Nenhum cliente encontrado para essa busca."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filtered.map((c) => {
            const address = formatAddress(c.address);
            return (
              <li key={c.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        c.active
                          ? "bg-secondary text-foreground"
                          : "bg-secondary/50 text-muted-foreground",
                      )}
                    >
                      {initials(c.full_name, c.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {c.full_name ?? "Sem nome"}
                        {!c.active && (
                          <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
                            Inativo
                          </Badge>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cliente desde {formatDate(c.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <UserActions userId={c.id} active={c.active} />
                  </div>
                </div>

                <dl className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                  <Info icon={Mail} label="E-mail" value={c.email} />
                  <Info
                    icon={Phone}
                    label="WhatsApp"
                    value={c.whatsapp ? maskPhone(c.whatsapp) : "Não informado"}
                  />
                  <div className="sm:col-span-2">
                    <Info icon={MapPin} label="Endereço" value={address ?? "Não informado"} />
                  </div>
                  <Info
                    icon={ShoppingBag}
                    label="Pedidos"
                    value={`${c.ordersCount} ${c.ordersCount === 1 ? "pedido" : "pedidos"} · ${formatBRL(c.totalSpent)}`}
                  />
                  <Info
                    icon={CalendarDays}
                    label="Último pedido"
                    value={c.lastOrderAt ? formatDate(c.lastOrderAt) : "Nenhum ainda"}
                  />
                </dl>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Exibindo {filtered.length} de {customers.length}{" "}
        {customers.length === 1 ? "cliente" : "clientes"}.
      </p>
    </div>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}
