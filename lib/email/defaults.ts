import type { EmailSettings, FulfillmentType, OrderStatus } from "@/types/db";

/** Chave de um e-mail transacional de pedido. */
export type OrderEmailEvent = keyof EmailSettings;

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
    key: "order_separated",
    label: "Em separação",
    short: "Ao iniciar a separação",
    desc: "Enviado quando o pedido entra em separação.",
  },
  {
    key: "order_ready_pickup",
    label: "Pronto para retirada",
    short: "Retirada na igreja",
    desc: "Enviado ao marcar 'Saiu para entrega' quando o cliente escolheu retirar na igreja.",
  },
  {
    key: "order_shipped",
    label: "Saiu para entrega",
    short: "Entrega no endereço",
    desc: "Enviado ao marcar 'Saiu para entrega' quando o pedido vai ser entregue no endereço do cliente.",
  },
  {
    key: "order_delivered",
    label: "Pedido entregue",
    short: "Ao marcar como entregue",
    desc: "Enviado quando o pedido é marcado como entregue.",
  },
  {
    key: "order_rejected",
    label: "Pedido não aceito",
    short: "Ao recusar o pedido",
    desc: "Enviado quando você recusa o pedido. O motivo informado entra no e-mail.",
  },
  {
    key: "order_canceled",
    label: "Pedido cancelado",
    short: "Ao cancelar o pedido",
    desc: "Enviado quando o pedido é cancelado. O motivo informado entra no e-mail.",
  },
] as const satisfies readonly {
  key: OrderEmailEvent;
  label: string;
  short: string;
  desc: string;
}[];

/** Eventos que exibem o motivo informado pelo admin. */
export const REASON_EVENTS: OrderEmailEvent[] = ["order_rejected", "order_canceled"];

/**
 * E-mail correspondente a uma transição de status. Retorna null quando o
 * status não notifica o cliente (`solicitado` já é coberto por order_placed,
 * disparado na criação do pedido).
 */
export function emailEventForStatus(
  status: OrderStatus,
  fulfillment: FulfillmentType,
): OrderEmailEvent | null {
  switch (status) {
    case "aceito":
      return "order_accepted";
    case "em_separacao":
      return "order_separated";
    case "saiu_entrega":
      return fulfillment === "retirada" ? "order_ready_pickup" : "order_shipped";
    case "entregue":
      return "order_delivered";
    case "recusado":
      return "order_rejected";
    case "cancelado":
      return "order_canceled";
    default:
      return null;
  }
}

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
  order_separated: {
    subject: "Seu pedido #{{pedido}} está em separação",
    heading: "Pedido em separação",
    intro:
      "Já estamos separando os itens do seu pedido com todo o cuidado. Você recebe um novo aviso assim que ele estiver pronto.",
  },
  order_ready_pickup: {
    subject: "Pedido #{{pedido}} pronto para retirada",
    heading: "Pronto para retirada",
    intro:
      "Seu pedido está separado e aguardando você na igreja. É só passar aqui no horário combinado para retirar.",
  },
  order_shipped: {
    subject: "Pedido #{{pedido}} saiu para entrega",
    heading: "Saiu para entrega",
    intro:
      "Seu pedido saiu para entrega e chega em breve ao endereço cadastrado. Fique atento ao WhatsApp — nosso entregador pode chamar você.",
  },
  order_delivered: {
    subject: "Pedido #{{pedido}} entregue — obrigado!",
    heading: "Pedido entregue",
    intro:
      "Seu pedido foi entregue. Muito obrigado por comprar com a Casa de Filadélfia — esperamos ver você de novo em breve.",
  },
  order_rejected: {
    subject: "Sobre o seu pedido #{{pedido}}",
    heading: "Pedido não aceito",
    intro:
      "Infelizmente não conseguimos aceitar o seu pedido desta vez. Se quiser tentar novamente ou tirar alguma dúvida, fale com a gente — teremos prazer em ajudar.",
  },
  order_canceled: {
    subject: "Pedido #{{pedido}} cancelado",
    heading: "Pedido cancelado",
    intro:
      "Seu pedido foi cancelado. Se não era isso que você esperava ou quiser refazer a compra, é só falar com a gente.",
  },
};
