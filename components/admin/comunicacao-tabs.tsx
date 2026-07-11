"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Mail } from "lucide-react";
import type { ReactNode } from "react";

export function ComunicacaoTabs({
  pagamento,
  emails,
}: {
  pagamento: ReactNode;
  emails: ReactNode;
}) {
  return (
    <Tabs defaultValue="pagamento">
      <TabsList>
        <TabsTrigger value="pagamento">
          <Banknote className="size-4" /> Pix &amp; WhatsApp
        </TabsTrigger>
        <TabsTrigger value="emails">
          <Mail className="size-4" /> E-mails
        </TabsTrigger>
      </TabsList>

      <TabsContent value="pagamento" className="flex flex-col gap-4">
        {pagamento}
      </TabsContent>
      <TabsContent value="emails" className="flex flex-col gap-4">
        {emails}
      </TabsContent>
    </Tabs>
  );
}
