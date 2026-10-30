import { z } from "zod";

export const listPageSchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
}).strict();

export const listDiscoverySchema = listPageSchema.extend({
    scope: z.enum(["popular", "following", "friends", "mine", "saved"]).default("popular"),
    q: z.string().trim().max(100).default(""),
    sort: z.enum(["popular", "recent"]).default("popular"),
}).strict();

export type ListDiscoveryQuery = z.infer<typeof listDiscoverySchema>;

export const listImageParamsSchema = z.object({
    listId: z.coerce.number().int().positive(),
    kind: z.enum(["thumbnail", "banner"]),
});

export const listMoveSchema = z.object({
    revision: z.number().int().min(0).max(4294967294),
    itemId: z.number().int().positive().safe(),
    toPosition: z.number().int().positive().max(2147483647),
}).strict();

export const createListSchema = z.object({
    title: z
        .string({ required_error: "title is required" })
        .trim()
        .min(1, "title is required")
        .max(255, "title too long"),
    description: z.string().trim().max(2000, "description too long").optional(),
    isPublic: z.boolean().optional().default(true),
});

export const updateListSchema = z
    .object({
        title: z.string().trim().min(1).max(255).optional(),
        description: z.string().trim().max(2000).optional(),
        isPublic: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Provide at least one field to update",
    });

export const listItemSchema = z.object({
    albumId: z
        .string({ required_error: "albumId is required" })
        .trim()
        .min(1, "albumId is required")
        .max(255, "albumId too long"),
    albumTitle: z.string().trim().max(500).optional(),
    albumImage: z.string().trim().max(500).optional(),
    albumArtist: z.string().trim().max(500).optional(),
    position: z.coerce.number().int().min(0).optional(),
});

export const listIdParamSchema = z.object({
    listId: z.coerce
        .number({ invalid_type_error: "Invalid listId" })
        .int("Invalid listId")
        .positive("Invalid listId"),
});

export const listItemParamSchema = z.object({
    listId: z.coerce.number().int().positive(),
    albumId: z.string().trim().min(1).max(255),
});

export const userIdParamSchema = z.object({
    userId: z.coerce.number().int().positive(),
});
