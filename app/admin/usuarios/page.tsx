import { CardIconHeader } from "@/components/admin/card-icon-header";
import { UserActions } from "@/components/admin/user-actions";
import { UserCreateForm } from "@/components/admin/user-create-form";
import { UserRoleSelect } from "@/components/admin/user-role-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { listAdminUsers } from "@/lib/queries/admin";
import { Users } from "lucide-react";

/** Iniciais para o avatar (usa o nome; na falta, o e-mail). */
function initials(name: string | null, email: string): string {
  const src = (name ?? email).trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export default async function UsuariosPage() {
  const [users, me] = await Promise.all([listAdminUsers(), getProfile()]);
  // Só super administradores criam, promovem, desativam e excluem usuários.
  const canManage = me?.role === "super_admin";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 text-xl font-semibold">Usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Somente quem acessa o <strong>painel administrativo</strong>. Os clientes da loja ficam no
          menu <strong>Clientes</strong>.
        </p>
      </div>

      {!isSupabaseConfigured && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Conecte o Supabase para criar e listar usuários. O administrador nativo pode ser criado
          com <code>pnpm create-admin</code> (ver <code>docs/SETUP.md</code>).
        </div>
      )}

      {canManage ? (
        <UserCreateForm />
      ) : (
        isSupabaseConfigured && (
          <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
            Apenas <strong>super administradores</strong> podem criar, promover, desativar ou
            excluir usuários. Você pode consultar a lista abaixo.
          </div>
        )
      )}

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
                // Super admin gerencia todos, exceto a si mesmo e o dono do sistema.
                const canModerate = canManage && !isSelf && !u.isOwner;
                return (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                          u.active
                            ? "bg-secondary text-foreground"
                            : "bg-secondary/50 text-muted-foreground"
                        }`}
                      >
                        {initials(u.full_name, u.email)}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 truncate font-medium">
                          {u.full_name ?? "Sem nome"}
                          {u.isOwner && <Badge variant="secondary">dono</Badge>}
                          {isSelf && !u.isOwner && <Badge variant="secondary">você</Badge>}
                          {!u.active && (
                            <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
                              Inativo
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canManage && (
                        <UserRoleSelect
                          userId={u.id}
                          role={u.role}
                          disabled={isSelf || u.isOwner}
                        />
                      )}
                      {canModerate && (
                        <UserActions userId={u.id} active={u.active} ordersCount={u.ordersCount} />
                      )}
                    </div>
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
