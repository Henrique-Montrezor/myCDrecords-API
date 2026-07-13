import { z } from "zod";

export const profileUpsertSchema = z.object({
  bio: z
    .string({ required_error: "Bio is required" })
    .trim()
    .min(1, "Bio is required")
    .max(1000, "Bio too long"),
  avatar_url: z
    .string({ required_error: "avatar_url is required" })
    .trim()
    .url("avatar_url must be a valid URL")
    .max(255, "avatar_url too long"),
});

export const usernameParamSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(255),
});
