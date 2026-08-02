import { EmailForm } from "@/components/admin/email-form";
import { EmailSenderForm } from "@/components/admin/email-sender-form";
import { getSetting } from "@/lib/queries/admin";
import type { EmailSettings } from "@/types/db";

export default async function EmailConfigPage() {
  const [sender, email] = await Promise.all([
    getSetting<{ account?: string; port?: number; appPasswordEnc?: string | null }>("email_sender"),
    getSetting<EmailSettings>("email"),
  ]);

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">E-mail</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure a conta que dispara os e-mails automáticos e edite os modelos enviados aos
          clientes em cada etapa do pedido.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Conta de envio</h2>
        <EmailSenderForm
          account={sender?.account ?? ""}
          port={Number(sender?.port) === 587 ? 587 : 465}
          hasPassword={Boolean(sender?.appPasswordEnc)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold">Modelos de e-mail</h2>
          <p className="text-sm text-muted-foreground">
            Estes são os avisos automáticos que o sistema envia em cada etapa do pedido. Edite o
            assunto, o título e a mensagem — e envie um teste para você mesmo.
          </p>
        </div>
        <EmailForm email={email} />
      </section>
    </div>
  );
}
