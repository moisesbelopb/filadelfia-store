import { CardIconHeader } from "@/components/admin/card-icon-header";
import { UserCreateForm } from "@/components/admin/user-create-form";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { listUsers } from "@/lib/queries/admin";
import { Users } from "lucide-react";

/** Iniciais para o avatar (usa o nome; na falta, o e-mail). */
function initials(name: string | null, email: string): string {
  const src = (name ?? email).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function UsuariosPage() {
  const [users, me] = await Promise.all([listUsers(), getCurrentUser()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 text-xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie e gerencie quem acessa o painel administrativo.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Conecte o Supabase para criar e listar usuários. O administrador nativo pode ser criado
          com <code>pnpm create-admin</code> (ver <code>docs/SETUP.md</code>).
        </div>
      )}

      <UserCreateForm />

      <Card>
        <CardIconHeader
          icon={Users}
          title="Administradores"
          description={`${users.length} ${users.length === 1 ? "pessoa" : "pessoas"} com acesso ao painel.`}
        />
        <CardContent>
          {users.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum usuário para exibir.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
                        {initials(u.full_name, u.email)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {u.full_name ?? "Sem nome"}
                          {isSelf && <Badge variant="secondary">você</Badge>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <UserRoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
