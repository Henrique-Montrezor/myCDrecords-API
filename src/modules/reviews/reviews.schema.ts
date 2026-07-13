import { z } from "zod";

export const postReviewSchema = z.object({
  albumId: z
    .string({ required_error: "albumId is required" })
    .trim()
    .min(1, "albumId is required")
    .max(255, "albumId too long"),
  albumTitle: z.string().trim().max(500).optional(),
  albumImage: z.string().trim().max(500).optional(),
  albumArtist: z.string().trim().max(500).optional(),
  genre: z.string().trim().max(500).optional(),
  rating: z.coerce
    .number({ required_error: "rating is required", invalid_type_error: "rating must be a number" })
    .int("rating must be an integer")
    .min(1, "rating must be between 1 and 5")
    .max(5, "rating must be between 1 and 5"),
  text: z.string().trim().max(5000, "Text too long").optional(),
});

export const updateReviewSchema = z.object({
  rating: z.coerce
    .number({ required_error: "rating is required", invalid_type_error: "rating must be a number" })
    .int("rating must be an integer")
    .min(1, "rating must be between 1 and 5")
    .max(5, "rating must be between 1 and 5"),
  text: z.string().trim().max(5000, "Text too long").optional(),
});

export const reviewIdParamSchema = z.object({
  reviewId: z.coerce
    .number({ invalid_type_error: "Invalid reviewId" })
    .int("Invalid reviewId")
    .positive("Invalid reviewId"),
});

export const albumIdParamSchema = z.object({
  albumId: z.string().trim().min(1, "albumId is required").max(255),
});

export const userIdParamSchema = z.object({
  userId: z.coerce
    .number({ invalid_type_error: "Invalid userId" })
    .int("Invalid userId")
    .positive("Invalid userId"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
});
