import { EmailSenderForm } from "@/components/admin/email-sender-form";
import { getSetting } from "@/lib/queries/admin";

export default async function EmailConfigPage() {
  const sender = await getSetting<{
    account?: string;
    port?: number;
    appPasswordEnc?: string | null;
  }>("email_sender");

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 text-xl font-semibold">E-mail</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Configure a conta que dispara os e-mails automáticos aos clientes (pedido recebido,
          confirmado, entregue, etc.). Se nenhuma conta Gmail estiver ativa, o envio usa o remetente
          padrão.
        </p>
      </div>

      <EmailSenderForm
        account={sender?.account ?? ""}
        port={Number(sender?.port) === 587 ? 587 : 465}
        hasPassword={Boolean(sender?.appPasswordEnc)}
      />
    </div>
  );
}
