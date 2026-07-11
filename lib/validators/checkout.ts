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

export const checkoutSchema = z
  .object({
    customerName: z.string().min(2, "Informe seu nome"),
    customerWhatsapp: z.string().min(10, "WhatsApp inválido"),
    fulfillment: z.enum(["entrega", "retirada"]),
    // Preenchido só quando entrega; validado no superRefine abaixo.
    address: addressSchema.partial().optional(),
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
