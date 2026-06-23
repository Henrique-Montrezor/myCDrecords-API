import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import {
    listBadgesController,
    myBadgesController,
    userBadgesController,
} from "./gamification.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Gamificação
 *     description: Emblemas e conquistas por avaliações
 */

/**
 * @swagger
 * /api/gamification/badges:
 *   get:
 *     summary: Catálogo de emblemas disponíveis
 *     tags: [Gamificação]
 *     responses:
 *       200:
 *         description: Lista de emblemas
 */
router.get("/badges", asyncHandler(listBadgesController));

/**
 * @swagger
 * /api/gamification/me/badges:
 *   get:
 *     summary: Emblemas conquistados pelo usuário autenticado
 *     tags: [Gamificação]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Emblemas do usuário
 *       401:
 *         description: Não autenticado
 */
router.get("/me/badges", authMiddleware, asyncHandler(myBadgesController));

/**
 * @swagger
 * /api/gamification/users/{userId}/badges:
 *   get:
 *     summary: Emblemas conquistados por um usuário
 *     tags: [Gamificação]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Emblemas do usuário
 */
router.get("/users/:userId/badges", asyncHandler(userBadgesController));

export default router;
