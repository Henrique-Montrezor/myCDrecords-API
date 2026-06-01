import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { RegisterRequest, AuthTokenResponse, UserAuthResponse } from "./auth.entity";
import {
  createVerificationToken,
  findVerificationToken,
  markTokenAsUsed,
  updateUserEmail,
  updateUserPassword,
  markEmailAsVerified,
  storeRefreshToken,
  findRefreshToken,
  invalidateRefreshToken,
} from "./auth.repository";
import { createUser, findByEmail, findByUsername } from "../users/user.repository";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET || "your-reset-secret";
const JWT_VERIFY_SECRET = process.env.JWT_VERIFY_SECRET || "your-verify-secret";

// Generate access token
export function generateAccessToken(userId: number, email: string): string {
  return jwt.sign(
    { user_id: userId, email },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
}

// Generate refresh token
export function generateRefreshToken(userId: number): string {
  return jwt.sign(
    { user_id: userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

// Generate password reset token
export function generatePasswordResetToken(userId: number): string {
  return jwt.sign(
    { user_id: userId, type: "password_reset" },
    JWT_RESET_SECRET,
    { expiresIn: "1h" }
  );
}

// Generate email verification token
export function generateEmailVerificationToken(userId: number): string {
  return jwt.sign(
    { user_id: userId, type: "email_verify" },
    JWT_VERIFY_SECRET,
    { expiresIn: "24h" }
  );
}

// Verify JWT token
export function verifyToken(token: string, secret: string = JWT_SECRET): any {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error("Token inválido ou expirado");
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Compare password
export async function comparePassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// Register user
export async function registerUser(data: RegisterRequest) {
  // Validar se email já existe
  const existingEmail = await findByEmail(data.email);
  if (existingEmail) {
    throw new Error("Email já registrado");
  }

  // Validar se username já existe
  const existingUsername = await findByUsername(data.username);
  if (existingUsername) {
    throw new Error("Username já existe");
  }

  // Hash password
  const hashedPassword = await hashPassword(data.password);

  // Create user
  const user = await createUser({
    username: data.username,
    email: data.email,
    password: hashedPassword,
    is_active: true,
  } as any);

  return user;
}

// Create tokens pair
export async function createTokensPair(userId: number, email: string): Promise<AuthTokenResponse> {
  const accessToken = generateAccessToken(userId, email);
  const refreshToken = generateRefreshToken(userId);

  // Store refresh token in database
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await storeRefreshToken(userId, refreshToken, expiresAt);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string) {
  // Verify refresh token
  const decoded = verifyToken(refreshToken, JWT_REFRESH_SECRET);

  // Find refresh token in database
  const storedToken = await findRefreshToken(refreshToken);
  if (!storedToken) {
    throw new Error("Refresh token inválido");
  }

  // Get user from database to get email
  // This would need a function to get user by ID - you might need to add this to user.repository
  // For now, returning the new tokens
  
  const accessToken = generateAccessToken(decoded.user_id, "email@example.com");

  return {
    accessToken,
    expiresIn: 900, // 15 minutes in seconds
  };
}

// Request password reset
export async function requestPasswordReset(email: string) {
  const user = await findByEmail(email);
  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }

  const resetToken = generatePasswordResetToken(user.id);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await createVerificationToken(user.id, resetToken, "password_reset", expiresAt);

  // TODO: Send email with reset link
  // const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
  // await sendResetEmail(email, resetLink);

  return { success: true };
}

// Reset password
export async function resetPassword(token: string, newPassword: string) {
  // Verify reset token
  const decoded = verifyToken(token, JWT_RESET_SECRET);

  if (decoded.type !== "password_reset") {
    throw new Error("Token inválido para reset de senha");
  }

  // Find verification token
  const verificationToken = await findVerificationToken(token);
  if (!verificationToken) {
    throw new Error("Token de reset expirado ou já utilizado");
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user password
  await updateUserPassword(decoded.user_id, hashedPassword);

  // Mark token as used
  await markTokenAsUsed(verificationToken.id);

  return { success: true };
}

// Verify email
export async function verifyEmail(token: string) {
  // Verify verification token
  const decoded = verifyToken(token, JWT_VERIFY_SECRET);

  if (decoded.type !== "email_verify") {
    throw new Error("Token inválido para verificação de email");
  }

  // Find verification token
  const verificationToken = await findVerificationToken(token);
  if (!verificationToken) {
    throw new Error("Token de verificação expirado ou já utilizado");
  }

  // Mark email as verified
  await markEmailAsVerified(decoded.user_id);

  // Mark token as used
  await markTokenAsUsed(verificationToken.id);

  return { success: true };
}

// Update email (requires authentication)
export async function updateEmail(userId: number, newEmail: string) {
  // Check if new email is already in use
  const existingEmail = await findByEmail(newEmail);
  if (existingEmail && existingEmail.id !== userId) {
    throw new Error("Este email já está em uso");
  }

  // Update email
  await updateUserEmail(userId, newEmail);

  return { success: true };
}

// Logout
export async function logout(refreshToken: string) {
  try {
    await invalidateRefreshToken(refreshToken);
    return { success: true };
  } catch (error) {
    return { success: true }; // Always return success for logout
  }
}

// Generate a simple token for testing (should be removed in production)
export function generateSimpleToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
