import { CardIconHeader } from "@/components/admin/card-icon-header";
import { CustomersList } from "@/components/admin/customers-list";
import { Card, CardContent } from "@/components/ui/card";
import { listCustomers } from "@/lib/queries/admin";
import { Contact } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Clientes" };

// Cadastro de clientes muda a cada login/pedido — não cachear.
export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const customers = await listCustomers();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 text-xl font-semibold">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quem criou conta na loja. Traz os dados do cadastro (contato e endereço) e o resumo de
          compras. Os administradores do painel ficam no menu <strong>Usuários</strong>.
        </p>
      </div>

      <Card>
        <CardIconHeader
          icon={Contact}
          title="Clientes cadastrados"
          description={`${customers.length} ${
            customers.length === 1 ? "pessoa" : "pessoas"
          } com conta na loja.`}
        />
        <CardContent>
          <CustomersList customers={customers} />
        </CardContent>
      </Card>
    </div>
  );
}
