"use client";

import { saveEmailSender, sendEmailSenderTest } from "@/actions/admin/email-sender";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/use-toast";
import { KeyRound, Save, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Configura a conta @gmail.com que dispara os e-mails (Gmail SMTP). */
export function EmailSenderForm({
  account: initAccount,
  port: initPort,
  hasPassword,
}: {
  account: string;
  port: number;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initAccount);
  const [appPassword, setAppPassword] = useState("");
  const [port, setPort] = useState(initPort);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  function save() {
    startSave(async () => {
      const res = await saveEmailSender({ account, appPassword, port });
      if (!res.ok) {
        toast({ variant: "error", title: "Não foi possível salvar", description: res.error });
        return;
      }
      toast({
        variant: "success",
        title: account ? "Conta de envio salva" : "Conta de envio desativada",
      });
      setAppPassword("");
      router.refresh();
    });
  }

  function test() {
    startTest(async () => {
      const res = await sendEmailSenderTest();
      if (res.ok) {
        toast({
          variant: "success",
          title: "E-mail de teste enviado",
          description: `Enviado para ${res.data}. Confira a caixa (e o spam).`,
        });
      } else {
        toast({ variant: "error", title: "Falha no teste", description: res.error });
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
            <KeyRound className="size-4.5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Conta de envio (Gmail SMTP)</h2>
            <p className="text-sm text-muted-foreground">
              Envie os e-mails <strong>a partir de uma conta @gmail.com</strong>. Tem prioridade
              sobre o remetente padrão.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="gmail-account" className="text-sm font-medium">
              Conta Gmail
            </label>
            <Input
              id="gmail-account"
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="contato@gmail.com"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Os e-mails sairão deste endereço. Deixe vazio para desativar e voltar ao remetente
              padrão.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gmail-pass" className="text-sm font-medium">
              Senha de app
            </label>
            <Input
              id="gmail-pass"
              type="password"
              autoComplete="new-password"
              placeholder={
                hasPassword ? "•••• (deixe em branco para manter)" : "cole os 16 caracteres"
              }
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {hasPassword ? "Já há uma senha salva. " : ""}A senha é guardada{" "}
              <strong>cifrada</strong> e nunca é exibida.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="gmail-port" className="text-sm font-medium">
            Porta
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              id="gmail-port"
              value={String(port)}
              onChange={(e) => setPort(Number(e.target.value))}
              className="w-40"
            >
              <option value="465">465 (SSL)</option>
              <option value="587">587 (TLS)</option>
            </Select>
            <span className="text-xs text-muted-foreground">
              Servidor: <code className="rounded bg-secondary px-1.5 py-0.5">smtp.gmail.com</code>
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-foreground">
          <strong>Como obter a Senha de app:</strong> ative a verificação em 2 etapas na Conta
          Google →{" "}
          <a
            href="https://myaccount.google.com/apppasswords"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            gere uma Senha de app
          </a>{" "}
          e cole os 16 caracteres aqui. ⚠ Limite de ~500 e-mails/dia; para grande volume, prefira um
          domínio próprio no futuro.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={save} disabled={saving}>
            <Save className="size-4" /> {saving ? "Salvando..." : "Salvar conta de envio"}
          </Button>
          <Button type="button" variant="outline" onClick={test} disabled={testing}>
            <Send className="size-4" />{" "}
            {testing ? "Enviando..." : "Enviar e-mail de teste para mim"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
