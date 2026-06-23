import { z } from "zod";

export const userIdParamSchema = z.object({
    userId: z.coerce
        .number({ invalid_type_error: "userId inválido" })
        .int("userId inválido")
        .positive("userId inválido"),
});

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
});

export const voteSchema = z.object({
    targetType: z.enum(["review", "comment"], {
        required_error: "targetType é obrigatório",
        invalid_type_error: "targetType deve ser 'review' ou 'comment'",
    }),
    targetId: z.coerce
        .number({ required_error: "targetId é obrigatório", invalid_type_error: "targetId inválido" })
        .int("targetId inválido")
        .positive("targetId inválido"),
    value: z.coerce
        .number({ required_error: "value é obrigatório", invalid_type_error: "value inválido" })
        .refine((v) => v === 1 || v === -1, "value deve ser 1 (upvote) ou -1 (downvote)"),
});

export const voteTargetParamSchema = z.object({
    targetType: z.enum(["review", "comment"]),
    targetId: z.coerce.number().int().positive(),
});

export const removeVoteSchema = z.object({
    targetType: z.enum(["review", "comment"]),
    targetId: z.coerce.number().int().positive(),
});
