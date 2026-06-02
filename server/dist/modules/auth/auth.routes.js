"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = __importDefault(require("../../utils/asyncHandler"));
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const router = (0, express_1.Router)();
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
router.post("/register", (0, asyncHandler_1.default)(auth_controller_1.register));
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
router.post("/login", (0, asyncHandler_1.default)(auth_controller_1.login));
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
router.post("/logout", auth_middleware_1.default, (0, asyncHandler_1.default)(auth_controller_1.logoutUser));
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
router.post("/refresh", (0, asyncHandler_1.default)(auth_controller_1.refresh));
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
router.post("/password/request-reset", (0, asyncHandler_1.default)(auth_controller_1.requestReset));
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
router.post("/password/reset", (0, asyncHandler_1.default)(auth_controller_1.reset));
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
router.post("/email/verify", (0, asyncHandler_1.default)(auth_controller_1.verify));
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
router.patch("/email", auth_middleware_1.default, (0, asyncHandler_1.default)(auth_controller_1.updateEmailAddress));
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
router.get("/oauth/google", (0, asyncHandler_1.default)(auth_controller_1.googleOAuth));
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
router.get("/oauth/spotify", (0, asyncHandler_1.default)(auth_controller_1.spotifyOAuth));
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
router.get("/oauth/discord", (0, asyncHandler_1.default)(auth_controller_1.discordOAuth));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map