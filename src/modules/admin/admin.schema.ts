import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: "ID inválido" })
    .int("ID inválido")
    .positive("ID inválido"),
});

export const banUserSchema = z.object({
  reason: z
    .string({ required_error: "Motivo do banimento é obrigatório" })
    .trim()
    .min(1, "Motivo do banimento é obrigatório")
    .max(1000, "Motivo muito longo"),
});

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["open", "investigating", "resolved", "dismissed"]).optional(),
});
