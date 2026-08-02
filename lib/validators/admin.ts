import { z } from "zod";

export const orderStatusSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(["aceito", "em_separacao", "saiu_entrega", "entregue", "recusado", "cancelado"]),
  reason: z.string().max(500).optional(),
});
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

/** Conta de envio de e-mail (Gmail SMTP). `account` vazio = desativar (volta ao
 * remetente padrão). `appPassword` vazio = manter a senha já salva. */
export const emailSenderSchema = z.object({
  account: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.union([z.literal(""), z.string().email("E-mail inválido")]),
  ),
  appPassword: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s+/g, "") : v),
    z.string().max(200),
  ),
  port: z.coerce
    .number()
    .int()
    .refine((p) => p === 465 || p === 587, "Porta deve ser 465 ou 587"),
});
export type EmailSenderInput = z.infer<typeof emailSenderSchema>;

/** Edição da forma de pagamento pelo admin (corrigir o que foi realmente pago). */
export const paymentEditSchema = z
  .object({
    orderId: z.string().uuid(),
    paymentMethod: z.enum(["pix", "dinheiro", "cartao"]),
    cardBrand: z.enum(["visa", "master", "outros"]).nullable().optional(),
    cardInstallments: z.coerce.number().int().min(1).max(6).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.paymentMethod !== "cartao") return;
    if (!d.cardBrand) {
      ctx.addIssue({ code: "custom", path: ["cardBrand"], message: "Escolha a bandeira" });
    }
    if (!d.cardInstallments) {
      ctx.addIssue({ code: "custom", path: ["cardInstallments"], message: "Escolha as parcelas" });
    }
  });
export type PaymentEditInput = z.infer<typeof paymentEditSchema>;

/** Registro de um pagamento (parcial ou total) no pedido. */
export const orderPaymentSchema = z
  .object({
    orderId: z.string().uuid(),
    amount: z.coerce.number().positive("Informe um valor maior que zero"),
    method: z.enum(["pix", "dinheiro", "cartao"]),
    cardInstallments: z.coerce.number().int().min(1).max(6).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.method === "cartao" && !d.cardInstallments) {
      ctx.addIssue({ code: "custom", path: ["cardInstallments"], message: "Escolha as parcelas" });
    }
  });
export type OrderPaymentInput = z.infer<typeof orderPaymentSchema>;

export const productSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  categoryId: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.string().uuid().nullable(),
  ),
  descriptionShort: z.string().max(160).optional(),
  descriptionLong: z.string().optional(),
  price: z.coerce.number().nonnegative("Preço inválido"),
  // Preço de custo: opcional (campo vazio => null). Base para a margem no admin.
  costPrice: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : v),
    z.coerce.number().nonnegative("Custo inválido").nullable(),
  ),
  // Estoque total é derivado das variantes (tamanhos); mantido opcional p/ compat.
  stock: z.coerce.number().int().nonnegative("Estoque inválido").optional().default(0),
  colorName: z.string().max(40).optional(),
  colorHex: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/i, "Use um hex como #161616")
      .optional(),
  ),
  colorGroup: z.string().max(60).optional(),
  isActive: z.coerce.boolean().default(true),
  isFeatured: z.coerce.boolean().default(false),
});
export type ProductInput = z.infer<typeof productSchema>;

export const categorySchema = z.object({
  name: z.string().min(2, "Informe o nome da categoria").max(40),
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(2, "Nome muito curto").max(40).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const productVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        size: z.string().min(1, "Informe o tamanho").max(12),
        stock: z.coerce.number().int().min(0, "Estoque inválido"),
      }),
    )
    .max(60),
});
export type ProductVariantsInput = z.infer<typeof productVariantsSchema>;

export const pixSettingsSchema = z.object({
  chave: z.string().min(1, "Informe a chave Pix"),
  recebedor: z.string().min(1, "Informe o nome do recebedor"),
  banco: z.string().optional(),
  observacao: z.string().optional(),
  whatsapp_loja: z.string().optional(),
});
export type PixSettingsInput = z.infer<typeof pixSettingsSchema>;

const emailTemplateSchema = z.object({
  subject: z.string().min(1, "Informe o assunto"),
  heading: z.string().min(1, "Informe o título"),
  intro: z.string().min(1, "Informe a mensagem"),
});

export const emailSettingsSchema = z.object({
  order_placed: emailTemplateSchema,
  order_accepted: emailTemplateSchema,
  order_separated: emailTemplateSchema,
  order_ready_pickup: emailTemplateSchema,
  order_shipped: emailTemplateSchema,
  order_delivered: emailTemplateSchema,
  order_rejected: emailTemplateSchema,
  order_canceled: emailTemplateSchema,
  cart_abandoned: emailTemplateSchema,
});

/** Chaves aceitas no envio de e-mail de teste (espelha EmailSettings). */
export const emailEventSchema = z.enum([
  "order_placed",
  "order_accepted",
  "order_separated",
  "order_ready_pickup",
  "order_shipped",
  "order_delivered",
  "order_rejected",
  "order_canceled",
  "cart_abandoned",
]);

export const templateSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  body: z.string().min(1, "A mensagem não pode ficar vazia"),
});

const timeString = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido");

const scheduleSlotSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  start: timeString,
  end: timeString,
});

export const deliverySettingsSchema = z.object({
  deliveryEnabled: z.coerce.boolean(),
  pickupEnabled: z.coerce.boolean(),
  cityFees: z
    .array(
      z.object({
        city: z.string().min(1, "Informe a cidade"),
        fee: z.coerce.number().nonnegative("Taxa inválida"),
      }),
    )
    .max(50),
  deliverySchedule: z.array(scheduleSlotSchema).max(50),
  pickupSchedule: z.array(scheduleSlotSchema).max(50),
  leadDays: z.coerce.number().int().min(1).max(60),
  pickupAddress: z.string().optional(),
  pickupInfo: z.string().optional(),
});
export type DeliverySettingsInput = z.infer<typeof deliverySettingsSchema>;

export const visualSettingsSchema = z.object({
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  radius: z.coerce.number().min(0).max(24).optional(),
  glass: z.coerce.boolean().optional(),
  glassBlur: z.coerce.number().min(0).max(24).optional(),
  glassOpacity: z.coerce.number().min(40).max(100).optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
});

export const createUserSchema = z.object({
  name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha precisa de ao menos 8 caracteres"),
  role: z.enum(["admin", "super_admin"]).default("admin"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Troca da própria senha (exige a senha atual para reautenticar). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "A nova senha precisa de ao menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a nova senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas não conferem",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "A nova senha deve ser diferente da atual",
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Troca do próprio e-mail (exige a senha atual para reautenticar). */
export const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newEmail: z.string().trim().toLowerCase().email("E-mail inválido"),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export const setRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["cliente", "admin", "super_admin"]),
});

export const setActiveSchema = z.object({
  userId: z.string().uuid(),
  active: z.coerce.boolean(),
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

export const adjustStockSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(["entrada", "ajuste"]),
  quantity: z.coerce.number().int().positive("Quantidade inválida"),
  reason: z.string().max(300).optional(),
});
