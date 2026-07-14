import { isValidPhone, maskPhone, titleCaseName } from "@/lib/utils";
import { z } from "zod";

export const addressSchema = z.object({
  street: z.string().min(2, "Informe a rua"),
  number: z.string().min(1, "Nº"),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, "Informe o bairro"),
  city: z.string().min(2, "Informe a cidade"),
  state: z.string().length(2, "UF"),
  zip: z.string().min(8, "CEP inválido").max(9),
});

// Base "solta": o formulário sempre envia strings (podem vir vazias). A
// obrigatoriedade real do endereço é aplicada no superRefine, só na ENTREGA —
// assim a retirada não exige endereço (senão dava "Informe a rua" na retirada).
const looseAddressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

export const checkoutSchema = z
  .object({
    // Mesmos padrões do cadastro: nome com iniciais maiúsculas e WhatsApp
    // sempre em (DD) XXXXX-XXXX (a máscara já impede letras no campo).
    customerName: z.string().trim().min(2, "Informe seu nome completo").transform(titleCaseName),
    customerWhatsapp: z
      .string()
      .trim()
      .refine(isValidPhone, "WhatsApp inválido — use (DD) 9XXXX-XXXX")
      .transform(maskPhone),
    fulfillment: z.enum(["entrega", "retirada"]),
    // Base solta; a exigência real é no superRefine, só na entrega.
    address: looseAddressSchema.optional(),
    scheduledDate: z.string().min(1, "Escolha um dia"),
    scheduledWindow: z.string().min(1, "Escolha um horário"),
    notes: z.string().max(500).optional(),
    paymentMethod: z.enum(["pix", "dinheiro", "cartao"]),
  })
  .superRefine((d, ctx) => {
    if (d.fulfillment !== "entrega") return;
    const parsed = addressSchema.safeParse(d.address);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", path: ["address", ...issue.path], message: issue.message });
      }
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const cartItemInput = z.object({
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CartItemInput = z.infer<typeof cartItemInput>;
