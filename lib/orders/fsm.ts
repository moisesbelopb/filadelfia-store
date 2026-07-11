import type { OrderStatus } from "@/types/db";

/** Passos "felizes" do fluxo (para a timeline). */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "solicitado",
  "aceito",
  "em_separacao",
  "saiu_entrega",
  "entregue",
];

export const FINAL_STATUSES: OrderStatus[] = ["entregue", "recusado", "cancelado"];

/** Espelho do trigger order_transition_allowed (SQL é a autoridade). */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  solicitado: ["aceito", "recusado", "cancelado"],
  aceito: ["em_separacao", "cancelado"],
  em_separacao: ["saiu_entrega", "cancelado"],
  saiu_entrega: ["entregue", "cancelado"],
  entregue: [],
  recusado: [],
  cancelado: [],
};

export const REASON_REQUIRED: OrderStatus[] = ["recusado", "cancelado"];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from];
}

export function isFinal(status: OrderStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  solicitado: "Solicitado",
  aceito: "Aceito",
  em_separacao: "Em separação",
  saiu_entrega: "Saiu para entrega",
  entregue: "Entregue",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

/** Mensagem exibida ao cliente por status (seção 8 do plano). */
export const STATUS_CUSTOMER_MSG: Record<OrderStatus, string> = {
  solicitado: "Recebemos sua solicitação. Aguarde a confirmação da equipe.",
  aceito: "Pedido aceito pela Casa de Filadélfia.",
  em_separacao: "Estamos separando/preparando seu pedido.",
  saiu_entrega: "Seu pedido saiu para entrega.",
  entregue: "Pedido entregue. Obrigado!",
  recusado: "Pedido não aceito.",
  cancelado: "Pedido cancelado.",
};

export type StatusVariant =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "secondary"
  | "muted";

export const STATUS_BADGE_VARIANT: Record<OrderStatus, StatusVariant> = {
  solicitado: "warning",
  aceito: "default",
  em_separacao: "default",
  saiu_entrega: "default",
  entregue: "success",
  recusado: "destructive",
  cancelado: "muted",
};

export const PAYMENT_LABEL: Record<string, string> = {
  pix: "Pix na entrega",
  dinheiro: "Dinheiro na entrega",
  cartao: "Cartão na entrega",
};
