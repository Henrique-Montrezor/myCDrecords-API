import { z } from "zod";

export const profileUpsertSchema = z.object({
  bio: z.string().trim().max(1000, "Bio too long").default(""),
  avatar_url: z
    .string()
    .trim()
    .max(255, "avatar_url too long")
    .refine((value) => value === "" || /^https?:\/\//i.test(value), "avatar_url must be an http(s) URL")
    .refine((value) => value === "" || URL.canParse(value), "avatar_url must be a valid URL")
    .default(""),
});

export const usernameParamSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(255),
});

export const userIdParamSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export const MAX_FAVORITES = 4;

const favoriteAlbumSchema = z.object({
  albumId: z.string().trim().min(1, "albumId is required").max(255),
  albumTitle: z.string().trim().max(500).optional(),
  albumImage: z.string().trim().max(500).optional(),
  albumArtist: z.string().trim().max(500).optional(),
});

export const favoritesSchema = z.object({
  albums: z
    .array(favoriteAlbumSchema)
    .max(MAX_FAVORITES, `At most ${MAX_FAVORITES} favorites`)
    .refine((albums) => new Set(albums.map((album) => album.albumId)).size === albums.length, "Duplicate albums"),
});

export type FavoriteAlbumInput = z.infer<typeof favoriteAlbumSchema>;
