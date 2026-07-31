/**
 * Cálculo do parcelamento no cartão de crédito (taxas da maquininha).
 *
 * A taxa é SEMPRE repassada ao cliente (modelo líquido): o cliente paga o
 * pedido + a taxa, e a loja recebe o valor cheio do pedido.
 *
 * Usamos os COEFICIENTES EXATOS do app da maquininha (medidos com R$ 100,00 no
 * simulador do app) — batem ao centavo com o app. Para outros valores, o total é
 * `pedido × coeficiente` arredondado (fica dentro de ~1 centavo).
 *
 * Fonte única: usado no checkout, na tela do pedido e no admin. Se as taxas do
 * app mudarem, basta atualizar a tabela COEF abaixo (Total ÷ 100 de cada parcela).
 */

export type CardBrand = "visa" | "master" | "outros";

export const CARD_BRANDS: { value: CardBrand; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "outros", label: "Outros" },
];

export const MAX_INSTALLMENTS = 6;

/**
 * Coeficiente de repasse por bandeira (índice 0 = 1x … índice 5 = 6x).
 * Origem: "Total de R$" do simulador do app para uma venda de R$ 100,00.
 */
const COEF: Record<CardBrand, number[]> = {
  visa: [1.0332, 1.0537, 1.0612, 1.0689, 1.0766, 1.0842],
  master: [1.0321, 1.0537, 1.0612, 1.0689, 1.0766, 1.0842],
  outros: [1.0363, 1.0553, 1.0629, 1.0706, 1.0783, 1.086],
};

const round2 = (v: number) => Math.round(v * 100) / 100;

function clampN(installments: number): number {
  return Math.min(Math.max(1, Math.round(installments)), MAX_INSTALLMENTS);
}

/** Fator de repasse (líquido): quanto o cliente paga por real de pedido. */
export function cardCoef(brand: CardBrand, installments: number): number {
  return COEF[brand][clampN(installments) - 1] ?? 1;
}

/** Total cobrado no cartão (pedido + taxa repassada). */
export function cardTotal(brand: CardBrand, installments: number, orderTotal: number): number {
  return round2(orderTotal * cardCoef(brand, installments));
}

/** Valor de cada parcela. */
export function cardInstallmentValue(
  brand: CardBrand,
  installments: number,
  orderTotal: number,
): number {
  return round2(cardTotal(brand, installments, orderTotal) / clampN(installments));
}

/** Taxa efetiva embutida no total (%) — uso interno, não exibida ao cliente. */
export function cardFeePct(brand: CardBrand, installments: number): number {
  return (1 - 1 / cardCoef(brand, installments)) * 100;
}

export function cardBrandLabel(brand: CardBrand): string {
  return CARD_BRANDS.find((b) => b.value === brand)?.label ?? brand;
}

/** Resumo pronto para exibir: "Mastercard · 3x de R$ 35,37 (total R$ 106,12)". */
export function cardSummary(
  brand: CardBrand,
  installments: number,
  orderTotal: number,
): { brandLabel: string; installments: number; parcela: number; total: number } {
  const n = clampN(installments);
  return {
    brandLabel: cardBrandLabel(brand),
    installments: n,
    parcela: cardInstallmentValue(brand, n, orderTotal),
    total: cardTotal(brand, n, orderTotal),
  };
}
