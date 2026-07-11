import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a Casa de Filadélfia usa seus dados.",
};

export default function PrivacidadePage() {
  return (
    <article className="prose prose-sm mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <p className="mt-2 text-sm text-muted-foreground">Última atualização: julho de 2026.</p>

      <Section title="Quais dados coletamos">
        Coletamos apenas o necessário para processar e entregar seu pedido: nome, número de
        WhatsApp, endereço de entrega e o histórico dos seus pedidos.
      </Section>

      <Section title="Como usamos seus dados">
        Usamos seus dados para: identificar você na loja, preparar e entregar o pedido, e nos
        comunicar pelo WhatsApp sobre o andamento do pedido e o envio da chave Pix (quando você
        escolhe pagar com Pix na entrega).
      </Section>

      <Section title="Comunicações por WhatsApp">
        Ao finalizar um pedido, você concorda que a Casa de Filadélfia utilize seu número de
        WhatsApp para enviar avisos do pedido e, se aplicável, a chave Pix — sempre após a
        confirmação do pedido pela equipe.
      </Section>

      <Section title="Compartilhamento">
        Não vendemos seus dados. Eles são usados internamente para a operação da loja e tratados com
        segurança (acesso restrito e proteção das chaves sensíveis no servidor).
      </Section>

      <Section title="Seus direitos">
        Você pode solicitar acesso, correção ou exclusão dos seus dados entrando em contato com a
        equipe da Casa de Filadélfia pelos canais oficiais.
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-foreground/90">{children}</p>
    </section>
  );
}
