import { z } from "zod";

export const registerSchema = z
  .object({
    username: z
      .string({ required_error: "Username é obrigatório" })
      .trim()
      .min(3, "Username deve ter pelo menos 3 caracteres")
      .max(255, "Username muito longo"),
    email: z
      .string({ required_error: "Email é obrigatório" })
      .trim()
      .email("Email inválido")
      .max(255, "Email muito longo"),
    password: z
      .string({ required_error: "Senha é obrigatória" })
      .min(8, "Senha deve ter pelo menos 8 caracteres")
      .max(128, "Senha muito longa"),
    confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string({ required_error: "Email é obrigatório" }).trim().email("Email inválido"),
  password: z.string({ required_error: "Senha é obrigatória" }).min(1, "Senha é obrigatória"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string({ required_error: "Email é obrigatório" }).trim().email("Email inválido"),
});

export const passwordResetSchema = z
  .object({
    token: z.string({ required_error: "Token é obrigatório" }).min(1, "Token é obrigatório"),
    password: z
      .string({ required_error: "Senha é obrigatória" })
      .min(8, "Senha deve ter pelo menos 8 caracteres")
      .max(128, "Senha muito longa"),
    confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const emailVerificationSchema = z.object({
  token: z.string({ required_error: "Token é obrigatório" }).min(1, "Token é obrigatório"),
});

export const emailUpdateSchema = z.object({
  email: z.string({ required_error: "Email é obrigatório" }).trim().email("Email inválido"),
});
