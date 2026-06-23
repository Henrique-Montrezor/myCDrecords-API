import { z } from "zod";

export const postReviewSchema = z.object({
  albumId: z
    .string({ required_error: "albumId é obrigatório" })
    .trim()
    .min(1, "albumId é obrigatório")
    .max(255, "albumId muito longo"),
  albumTitle: z.string().trim().max(500).optional(),
  albumImage: z.string().trim().max(500).optional(),
  albumArtist: z.string().trim().max(500).optional(),
  genre: z.string().trim().max(500).optional(),
  rating: z.coerce
    .number({ required_error: "rating é obrigatório", invalid_type_error: "rating deve ser um número" })
    .int("rating deve ser um inteiro")
    .min(1, "rating deve estar entre 1 e 5")
    .max(5, "rating deve estar entre 1 e 5"),
  text: z.string().trim().max(5000, "Texto muito longo").optional(),
});

export const updateReviewSchema = z.object({
  rating: z.coerce
    .number({ required_error: "rating é obrigatório", invalid_type_error: "rating deve ser um número" })
    .int("rating deve ser um inteiro")
    .min(1, "rating deve estar entre 1 e 5")
    .max(5, "rating deve estar entre 1 e 5"),
  text: z.string().trim().max(5000, "Texto muito longo").optional(),
});

export const reviewIdParamSchema = z.object({
  reviewId: z.coerce
    .number({ invalid_type_error: "reviewId inválido" })
    .int("reviewId inválido")
    .positive("reviewId inválido"),
});

export const albumIdParamSchema = z.object({
  albumId: z.string().trim().min(1, "albumId é obrigatório").max(255),
});

export const userIdParamSchema = z.object({
  userId: z.coerce
    .number({ invalid_type_error: "userId inválido" })
    .int("userId inválido")
    .positive("userId inválido"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
});
