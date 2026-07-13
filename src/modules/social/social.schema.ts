import { z } from "zod";

export const userIdParamSchema = z.object({
    userId: z.coerce
        .number({ invalid_type_error: "Invalid userId" })
        .int("Invalid userId")
        .positive("Invalid userId"),
});

export const paginationQuerySchema = z.object({
    page: z.coerce.number().int().positive().optional().default(1),
});

export const voteSchema = z.object({
    targetType: z.enum(["review", "comment"], {
        required_error: "targetType is required",
        invalid_type_error: "targetType must be 'review' or 'comment'",
    }),
    targetId: z.coerce
        .number({ required_error: "targetId is required", invalid_type_error: "Invalid targetId" })
        .int("Invalid targetId")
        .positive("Invalid targetId"),
    value: z.coerce
        .number({ required_error: "value is required", invalid_type_error: "Invalid value" })
        .refine((v) => v === 1 || v === -1, "value must be 1 (upvote) or -1 (downvote)"),
});

export const voteTargetParamSchema = z.object({
    targetType: z.enum(["review", "comment"]),
    targetId: z.coerce.number().int().positive(),
});

export const removeVoteSchema = z.object({
    targetType: z.enum(["review", "comment"]),
    targetId: z.coerce.number().int().positive(),
});
