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
 *     summary: Register account
 *     tags: [Authentication]
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
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post("/register", asyncHandler(register));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login
 *     tags: [Authentication]
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
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", asyncHandler(login));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Not authenticated
 */
router.post("/logout", authMiddleware, asyncHandler(logoutUser));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
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
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post("/refresh", asyncHandler(refresh));

/**
 * @swagger
 * /api/auth/password/request-reset:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
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
 *         description: Request processed
 */
router.post("/password/request-reset", asyncHandler(requestReset));

/**
 * @swagger
 * /api/auth/password/reset:
 *   post:
 *     summary: Reset password
 *     tags: [Authentication]
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
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post("/password/reset", asyncHandler(reset));

/**
 * @swagger
 * /api/auth/email/verify:
 *   post:
 *     summary: Verify email
 *     tags: [Authentication]
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
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.post("/email/verify", asyncHandler(verify));

/**
 * @swagger
 * /api/auth/email:
 *   patch:
 *     summary: Update email
 *     tags: [Authentication]
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
 *         description: Email updated successfully
 *       401:
 *         description: Not authenticated
 */
router.patch("/email", authMiddleware, asyncHandler(updateEmailAddress));

/**
 * @swagger
 * /api/auth/oauth/google:
 *   get:
 *     summary: OAuth Google
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Google
 *     responses:
 *       200:
 *         description: OAuth started
 */
router.get("/oauth/google", asyncHandler(googleOAuth));

/**
 * @swagger
 * /api/auth/oauth/spotify:
 *   get:
 *     summary: OAuth Spotify
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Spotify
 *     responses:
 *       200:
 *         description: OAuth started
 */
router.get("/oauth/spotify", asyncHandler(spotifyOAuth));

/**
 * @swagger
 * /api/auth/oauth/discord:
 *   get:
 *     summary: OAuth Discord
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema:
 *           type: string
 *         description: Authorization code from Discord
 *     responses:
 *       200:
 *         description: OAuth started
 */
router.get("/oauth/discord", asyncHandler(discordOAuth));

export default router;
