import { PixForm } from "@/components/admin/pix-form";
import { getMessageTemplate, getSetting } from "@/lib/queries/admin";
import type { PixSettings } from "@/types/db";

export default async function ComunicacaoConfigPage() {
  const [pix, template] = await Promise.all([
    getSetting<PixSettings>("pix"),
    getMessageTemplate("pix"),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">Comunicação</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure o pagamento: a chave Pix e o WhatsApp da loja usados na cobrança. Os e-mails
          automáticos agora ficam no menu <strong>E-mail</strong>.
        </p>
      </div>

      <PixForm pix={pix} template={template} />
    </div>
  );
}
