/**
 * Cálculo do parcelamento no cartão de crédito (taxas da maquininha).
 *
 * A taxa é SEMPRE repassada ao cliente (modelo líquido): o cliente paga o
 * pedido + a taxa, e a loja recebe o valor cheio do pedido. O acréscimo do
 * parcelamento é aplicado como juros de antecipação compostos (fórmula "B",
 * calibrada com o app da maquininha — bate dentro de centavos).
 *
 * Fonte única: usado no checkout, na tela do pedido e no admin. Se um dia a
 * loja quiser bater ao centavo, basta trocar RATES por uma tabela de
 * coeficientes exatos do app.
 */

export type CardBrand = "visa" | "master" | "outros";

export const CARD_BRANDS: { value: CardBrand; label: string }[] = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "outros", label: "Outros" },
];

export const MAX_INSTALLMENTS = 6;

/** Taxas por bandeira (dos prints): à vista, parcelado 2–6x, acréscimo/mês. */
const RATES: Record<CardBrand, { avista: number; parcelado: number; mes: number }> = {
  visa: { avista: 3.21, parcelado: 3.01, mes: 1.41 },
  master: { avista: 3.11, parcelado: 3.01, mes: 1.41 },
  outros: { avista: 3.99, parcelado: 3.99, mes: 2.99 },
};

const round2 = (v: number) => Math.round(v * 100) / 100;

function clampN(installments: number): number {
  return Math.min(Math.max(1, Math.round(installments)), MAX_INSTALLMENTS);
}

/** Fator de repasse (líquido): quanto o cliente paga por real de pedido. */
export function cardCoef(brand: CardBrand, installments: number): number {
  const r = RATES[brand];
  const n = clampN(installments);
  if (n <= 1) return 1 / (1 - r.avista / 100);
  const i = r.mes / 100;
  let sum = 0;
  for (let k = 1; k <= n; k++) sum += 1 / (1 + i) ** k; // valor presente das N parcelas
  const vp = sum / n;
  return 1 / (vp - r.parcelado / 100);
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

/** Taxa efetiva embutida no total (%). */
export function cardFeePct(brand: CardBrand, installments: number): number {
  return (1 - 1 / cardCoef(brand, installments)) * 100;
}

export function cardBrandLabel(brand: CardBrand): string {
  return CARD_BRANDS.find((b) => b.value === brand)?.label ?? brand;
}

/** Resumo pronto para exibir: "Mastercard · 3x de R$ 42,33 (total R$ 126,99)". */
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
