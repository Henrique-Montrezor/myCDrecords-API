import { z } from "zod";

export const profileUpsertSchema = z.object({
  bio: z
    .string({ required_error: "Bio é obrigatória" })
    .trim()
    .min(1, "Bio é obrigatória")
    .max(1000, "Bio muito longa"),
  avatar_url: z
    .string({ required_error: "avatar_url é obrigatória" })
    .trim()
    .url("avatar_url deve ser uma URL válida")
    .max(255, "avatar_url muito longa"),
});

export const usernameParamSchema = z.object({
  username: z.string().trim().min(1, "Username é obrigatório").max(255),
});
