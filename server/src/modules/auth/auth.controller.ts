import { Request, Response } from "express";
import {
  registerUser,
  createTokensPair,
  comparePassword,
  verifyToken,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  updateEmail,
  logout,
  generateEmailVerificationToken,
} from "./auth.service";
import { findByEmail, findByIdForResponse } from "../users/user.repository";
import {
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  PasswordResetRequestPayload,
  PasswordResetPayload,
  EmailVerificationPayload,
  EmailUpdatePayload,
} from "./auth.entity";
import {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  emailVerificationSchema,
  emailUpdateSchema,
} from "./auth.schema";

// POST /auth/register
export async function register(req: Request, res: Response) {
  const { username, email, password } = registerSchema.parse(req.body);

  try {
    // Register user
    const user = await registerUser({ username, email, password });

    // Generate tokens
    const tokens = await createTokensPair(user.id, user.email);

    // Generate email verification token and send
    const verificationToken = generateEmailVerificationToken(user.id);

    // TODO: Send verification email with token

    // Set refresh token as secure cookie
    res.cookie("token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Return access token
    res.status(201).json({
      message: "Usuário registrado com sucesso",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error: any) {
    console.error("Register error:", error);
    res.status(400).json({ message: error.message || "Erro ao registrar" });
  }
}

// POST /auth/login
export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);

  try {
    // Find user
    const user = await findByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Compare password
    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ message: "Usuário inativo" });
    }

    // Generate tokens
    const tokens = await createTokensPair(user.id, user.email);

    // Set refresh token as secure cookie
    res.cookie("token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Login realizado com sucesso",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified,
      },
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Erro ao fazer login" });
  }
}

// POST /auth/logout
export async function logoutUser(req: Request, res: Response) {
  try{
    res.clearCookie("token");
    res.status(200).json({ message: "Logout realizado com sucesso" });
  } catch (error: any) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Erro ao fazer logout" });
  }
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response) {
  try {
    const refreshToken = req.cookies.token || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token não fornecido" });
    }

    // Refresh access token
    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      message: "Token renovado com sucesso",
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    });
  } catch (error: any) {
    console.error("Refresh error:", error);
    res.status(401).json({ message: "Refresh token inválido" });
  }
}

// POST /auth/password/request-reset
export async function requestReset(req: Request, res: Response) {
  const { email } = passwordResetRequestSchema.parse(req.body);

  try {
    await requestPasswordReset(email);

    // Always return success for security reasons
    res.status(200).json({
      message: "Se o email existe em nossa base de dados, você receberá um link de reset",
    });
  } catch (error: any) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Erro ao processar requisição" });
  }
}

// POST /auth/password/reset
export async function reset(req: Request, res: Response) {
  const { token, password } = passwordResetSchema.parse(req.body);

  try {
    await resetPassword(token, password);

    res.status(200).json({
      message: "Senha redefinida com sucesso",
    });
  } catch (error: any) {
    console.error("Password reset error:", error);
    res.status(400).json({ message: error.message || "Erro ao redefinir senha" });
  }
}

// POST /auth/email/verify
export async function verify(req: Request, res: Response) {
  const { token } = emailVerificationSchema.parse(req.body);

  try {
    await verifyEmail(token);

    res.status(200).json({
      message: "Email verificado com sucesso",
    });
  } catch (error: any) {
    console.error("Email verification error:", error);
    res.status(400).json({ message: error.message || "Erro ao verificar email" });
  }
}

// PATCH /auth/email
export async function updateEmailAddress(req: Request, res: Response) {
  const { email } = emailUpdateSchema.parse(req.body);

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    await updateEmail(userId, email);

    res.status(200).json({
      message: "Email atualizado com sucesso",
    });
  } catch (error: any) {
    console.error("Update email error:", error);
    res.status(400).json({ message: error.message || "Erro ao atualizar email" });
  }
}

// GET /auth/oauth/google
export async function googleOAuth(req: Request, res: Response) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: "Authorization code ausente" });
    }

    // TODO: Exchange code for tokens with Google
    // TODO: Get user info from Google
    // TODO: Create or find user
    // TODO: Generate JWT tokens
    // TODO: Redirect to frontend with tokens

    res.status(200).json({
      message: "OAuth Google iniciado",
      // Will redirect to frontend with tokens
    });
  } catch (error: any) {
    console.error("Google OAuth error:", error);
    res.status(500).json({ message: "Erro ao processar OAuth Google" });
  }
}

// GET /auth/oauth/spotify
export async function spotifyOAuth(req: Request, res: Response) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: "Authorization code ausente" });
    }

    // TODO: Exchange code for tokens with Spotify
    // TODO: Get user info from Spotify
    // TODO: Create or find user
    // TODO: Generate JWT tokens
    // TODO: Redirect to frontend with tokens

    res.status(200).json({
      message: "OAuth Spotify iniciado",
      // Will redirect to frontend with tokens
    });
  } catch (error: any) {
    console.error("Spotify OAuth error:", error);
    res.status(500).json({ message: "Erro ao processar OAuth Spotify" });
  }
}

// GET /auth/oauth/discord
export async function discordOAuth(req: Request, res: Response) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: "Authorization code ausente" });
    }

    // TODO: Exchange code for tokens with Discord
    // TODO: Get user info from Discord
    // TODO: Create or find user
    // TODO: Generate JWT tokens
    // TODO: Redirect to frontend with tokens

    res.status(200).json({
      message: "OAuth Discord iniciado",
      // Will redirect to frontend with tokens
    });
  } catch (error: any) {
    console.error("Discord OAuth error:", error);
    res.status(500).json({ message: "Erro ao processar OAuth Discord" });
  }
}
