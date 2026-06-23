import { z } from "zod";

export const createListSchema = z.object({
    title: z
        .string({ required_error: "title é obrigatório" })
        .trim()
        .min(1, "title é obrigatório")
        .max(255, "title muito longo"),
    description: z.string().trim().max(2000, "description muito longa").optional(),
    isPublic: z.boolean().optional().default(true),
});

export const updateListSchema = z
    .object({
        title: z.string().trim().min(1).max(255).optional(),
        description: z.string().trim().max(2000).optional(),
        isPublic: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: "Informe ao menos um campo para atualizar",
    });

export const listItemSchema = z.object({
    albumId: z
        .string({ required_error: "albumId é obrigatório" })
        .trim()
        .min(1, "albumId é obrigatório")
        .max(255, "albumId muito longo"),
    albumTitle: z.string().trim().max(500).optional(),
    albumImage: z.string().trim().max(500).optional(),
    albumArtist: z.string().trim().max(500).optional(),
    position: z.coerce.number().int().min(0).optional(),
});

export const listIdParamSchema = z.object({
    listId: z.coerce
        .number({ invalid_type_error: "listId inválido" })
        .int("listId inválido")
        .positive("listId inválido"),
});

export const listItemParamSchema = z.object({
    listId: z.coerce.number().int().positive(),
    albumId: z.string().trim().min(1).max(255),
});

export const userIdParamSchema = z.object({
    userId: z.coerce.number().int().positive(),
});
