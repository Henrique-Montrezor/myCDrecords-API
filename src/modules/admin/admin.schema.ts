import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce
    .number({ invalid_type_error: "Invalid ID" })
    .int("Invalid ID")
    .positive("Invalid ID"),
});

export const banUserSchema = z.object({
  reason: z
    .string({ required_error: "Ban reason is required" })
    .trim()
    .min(1, "Ban reason is required")
    .max(1000, "Reason too long"),
});

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(["open", "investigating", "resolved", "dismissed"]).optional(),
});
