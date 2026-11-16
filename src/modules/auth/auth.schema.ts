import { z } from "zod";

export const PUBLIC_REVIEW_NOTICE_VERSION = "public-reviews-v1";
export const publicReviewNoticeSchema = z.object({
  accepted: z.literal(true, { errorMap: () => ({ message: "Confirme que entende que as reviews serão públicas." }) }),
  version: z.literal(PUBLIC_REVIEW_NOTICE_VERSION, { errorMap: () => ({ message: "O aviso de reviews públicas mudou. Atualize a página e confirme novamente." }) }),
}).strict();
export type PublicReviewNoticeAcknowledgement = z.infer<typeof publicReviewNoticeSchema>;

export const registerSchema = z
  .object({
    username: z
      .string({ required_error: "Username is required" })
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(255, "Username too long"),
    email: z
      .string({ required_error: "Email is required" })
      .trim()
      .email("Invalid email")
      .max(255, "Email too long"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long"),
    confirmPassword: z.string({ required_error: "Password confirmation is required" }),
    publicReviewNotice: publicReviewNoticeSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().email("Invalid email"),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const passwordResetRequestSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().email("Invalid email"),
});

export const passwordResetSchema = z
  .object({
    token: z.string({ required_error: "Token is required" }).min(1, "Token is required"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long"),
    confirmPassword: z.string({ required_error: "Password confirmation is required" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const emailVerificationSchema = z.object({
  token: z.string({ required_error: "Token is required" }).min(1, "Token is required"),
});

export const emailUpdateSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().email("Invalid email"),
});
