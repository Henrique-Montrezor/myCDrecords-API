import { Router, Request, Response, NextFunction } from "express";
import asyncHandler from "../../utils/asyncHandler";
import {
  register,
  login,
  logoutUser,
  refresh,
  requestReset,
  reset,
  verify,
  updateEmailAddress,
  googleOAuth,
  spotifyOAuth,
  discordOAuth,
} from "./auth.controller";
import authMiddleware from "../../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar conta
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário registrado com sucesso
 *       400:
 *         description: Erro na validação
 */
router.post("/register", asyncHandler(register));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post("/login", asyncHandler(login));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout
 *     tags: [Autenticação]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.post("/logout", authMiddleware, asyncHandler(logoutUser));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Renovar token de acesso
 *     tags: [Autenticação]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *       401:
 *         description: Refresh token inválido
 */
router.post("/refresh", asyncHandler(refresh));

/**
 * @swagger
 * /api/auth/password/request-reset:
 *   post:
 *     summary: Solicitar reset de senha
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Solicitação processada
 */
router.post("/password/request-reset", asyncHandler(requestReset));

/**
 * @swagger
 * /api/auth/password/reset:
 *   post:
 *     summary: Redefinir senha
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido ou expirado
 */
router.post("/password/reset", asyncHandler(reset));

/**
 * @swagger
 * /api/auth/email/verify:
 *   post:
 *     summary: Verificar email
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verificado com sucesso
 *       400:
 *         description: Token inválido ou expirado
 */
router.post("/email/verify", asyncHandler(verify));

/**
 * @swagger
 * /api/auth/email:
 *   patch:
 *     summary: Atualizar email
 *     tags: [Autenticação]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email atualizado com sucesso
 *       401:
 *         description: Não autenticado
 */
router.patch("/email", authMiddleware, asyncHandler(updateEmailAddress));

/**
 * @swagger
 * /api/auth/oauth/google:
 *   get:
 *     summary: OAuth Google
 *     tags: [Autenticação]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *     responses:
 *       200:
 *         description: OAuth iniciado
 */
router.get("/oauth/google", asyncHandler(googleOAuth));

/**
 * @swagger
 * /api/auth/oauth/spotify:
 *   get:
 *     summary: OAuth Spotify
 *     tags: [Autenticação]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Spotify
 *     responses:
 *       200:
 *         description: OAuth iniciado
 */
router.get("/oauth/spotify", asyncHandler(spotifyOAuth));

/**
 * @swagger
 * /api/auth/oauth/discord:
 *   get:
 *     summary: OAuth Discord
 *     tags: [Autenticação]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Discord
 *     responses:
 *       200:
 *         description: OAuth iniciado
 */
router.get("/oauth/discord", asyncHandler(discordOAuth));

export default router;
