import { ComunicacaoTabs } from "@/components/admin/comunicacao-tabs";
import { EmailForm } from "@/components/admin/email-form";
import { PixForm } from "@/components/admin/pix-form";
import { getMessageTemplate, getSetting } from "@/lib/queries/admin";
import type { EmailSettings, PixSettings } from "@/types/db";

export default async function ComunicacaoConfigPage() {
  const [pix, template, email] = await Promise.all([
    getSetting<PixSettings>("pix"),
    getMessageTemplate("pix"),
    getSetting<EmailSettings>("email"),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">Comunicação</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure o pagamento (chave Pix e WhatsApp da loja) e os e-mails enviados ao cliente. No
          e-mail de confirmação, pedidos Pix recebem a chave e o botão de comprovante.
        </p>
      </div>

      <ComunicacaoTabs
        pagamento={<PixForm pix={pix} template={template} />}
        emails={<EmailForm email={email} />}
      />
    </div>
  );
}
