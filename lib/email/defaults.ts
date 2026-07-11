import type { EmailSettings } from "@/types/db";

/** Ordem e rótulos dos e-mails na tela de configuração. */
export const EMAIL_EVENTS = [
  {
    key: "order_placed",
    label: "Pedido recebido",
    short: "Ao finalizar a compra",
    desc: "Enviado automaticamente assim que o cliente finaliza a compra.",
  },
  {
    key: "order_accepted",
    label: "Pedido confirmado",
    short: "Ao aceitar o pedido",
    desc: "Enviado quando você aceita o pedido. Em pedidos Pix, a chave e o botão de comprovante entram automaticamente.",
  },
  {
    key: "order_delivered",
    label: "Pedido entregue",
    short: "Ao marcar como entregue",
    desc: "Enviado quando o pedido é marcado como entregue.",
  },
] as const;

/** Textos padrão dos e-mails (fallback quando nada foi salvo no admin). */
export const DEFAULT_EMAILS: EmailSettings = {
  order_placed: {
    subject: "Recebemos seu pedido #{{pedido}} — Casa de Filadélfia",
    heading: "Pedido recebido",
    intro:
      "Recebemos sua solicitação e ela já está na fila para confirmação. Avisaremos assim que o pedido for aceito pela nossa equipe.",
  },
  order_accepted: {
    subject: "Seu pedido #{{pedido}} foi confirmado",
    heading: "Pedido confirmado",
    intro:
      "Confirmamos o seu pedido! Já vamos dar andamento e você continuará recebendo as atualizações por aqui.",
  },
  order_delivered: {
    subject: "Pedido #{{pedido}} entregue — obrigado!",
    heading: "Pedido entregue",
    intro:
      "Seu pedido foi entregue. Muito obrigado por comprar com a Casa de Filadélfia — esperamos ver você de novo em breve.",
  },
};
