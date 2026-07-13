import { z } from "zod";

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
