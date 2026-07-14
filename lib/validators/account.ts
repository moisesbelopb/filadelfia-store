import { isValidPhone, maskPhone, titleCaseName } from "@/lib/utils";
import { addressSchema } from "@/lib/validators/checkout";
import { z } from "zod";

/**
 * "Minha conta" — os mesmos padrões do cadastro (nome com iniciais maiúsculas,
 * WhatsApp mascarado, e-mail válido). O servidor revalida tudo: a máscara do
 * navegador é conveniência, não garantia.
 */
export const personalSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").transform(titleCaseName),
  whatsapp: z
    .string()
    .trim()
    .refine(isValidPhone, "WhatsApp inválido — use (DD) 9XXXX-XXXX")
    .transform(maskPhone),
});
export type PersonalInput = z.infer<typeof personalSchema>;

/** Endereço padrão do cliente — mesmas regras do endereço de entrega. */
export const accountAddressSchema = addressSchema;
export type AccountAddressInput = z.infer<typeof accountAddressSchema>;

export const emailChangeSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});
export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

export const passwordChangeSchema = z
  .object({
    password: z.string().min(6, "A senha precisa de ao menos 6 caracteres"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não conferem",
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
