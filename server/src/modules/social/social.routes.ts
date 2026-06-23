import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import {
    followController,
    unfollowController,
    followersController,
    followingController,
    feedController,
    voteController,
    removeVoteController,
    voteScoreController,
} from "./social.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Social
 *     description: Seguidores e votos (up/downvotes)
 */

/**
 * @swagger
 * /api/social/feed:
 *   get:
 *     summary: Feed de avaliações dos usuários seguidos
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Lista de avaliações
 *       401:
 *         description: Não autenticado
 */
router.get("/feed", authMiddleware, asyncHandler(feedController));

/**
 * @swagger
 * /api/social/vote:
 *   post:
 *     summary: Registra ou atualiza um voto em uma review ou comentário
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId, value]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [review, comment]
 *               targetId:
 *                 type: integer
 *               value:
 *                 type: integer
 *                 enum: [1, -1]
 *     responses:
 *       200:
 *         description: Voto registrado
 *       401:
 *         description: Não autenticado
 *   delete:
 *     summary: Remove o voto do usuário em um alvo
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [review, comment]
 *               targetId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Voto removido
 *       404:
 *         description: Voto não encontrado
 */
router.post("/vote", authMiddleware, asyncHandler(voteController));
router.delete("/vote", authMiddleware, asyncHandler(removeVoteController));

/**
 * @swagger
 * /api/social/votes/{targetType}/{targetId}:
 *   get:
 *     summary: Pontuação de votos de um alvo
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: targetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [review, comment]
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Pontuação agregada
 */
router.get("/votes/:targetType/:targetId", asyncHandler(voteScoreController));

/**
 * @swagger
 * /api/social/follow/{userId}:
 *   post:
 *     summary: Seguir um usuário
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: Usuário seguido
 *       409:
 *         description: Já segue este usuário
 *   delete:
 *     summary: Deixar de seguir um usuário
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Deixou de seguir
 *       404:
 *         description: Não segue este usuário
 */
router.post("/follow/:userId", authMiddleware, asyncHandler(followController));
router.delete("/follow/:userId", authMiddleware, asyncHandler(unfollowController));

/**
 * @swagger
 * /api/social/{userId}/followers:
 *   get:
 *     summary: Lista os seguidores de um usuário
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de seguidores
 */
router.get("/:userId/followers", asyncHandler(followersController));

/**
 * @swagger
 * /api/social/{userId}/following:
 *   get:
 *     summary: Lista quem o usuário segue
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de seguidos
 */
router.get("/:userId/following", asyncHandler(followingController));

export default router;
