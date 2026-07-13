import { Router } from "express";
import { getRecommendations } from "./recommendations.controller";
import authMiddleware from "../../middlewares/auth.middleware";
import asyncHandler from "../../utils/asyncHandler";

const router = Router();

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: Get personalized recommendations for the user
 *     description: Returns a list of recommended albums based on collaborative filtering (what similar users like) or general popular ones if the user has no history.
 *     tags:
 *       - Recommendations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of recommendations to return.
 *     responses:
 *       200:
 *         description: List of recommendations generated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tipo:
 *                   type: string
 *                   example: "colaborativa"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       album_id:
 *                         type: string
 *                         example: "12345-abcde"
 *                       album_title:
 *                         type: string
 *                         example: "Nevermind"
 *                       album_artist:
 *                         type: string
 *                         example: "Nirvana"
 *                       album_image:
 *                         type: string
 *                         example: "https://url-da-capa.jpg"
 *                       genre:
 *                         type: string
 *                         example: "Rock"
 *                       afinidade_score:
 *                         type: integer
 *                         example: 3
 *                       nota_media:
 *                         type: number
 *                         format: float
 *                         example: 4.8
 *       401:
 *         description: Unauthorized. The authentication token is missing, invalid, or expired.
 *       500:
 *         description: Internal server error.
 */
router.get("/", authMiddleware, asyncHandler(getRecommendations));

export default router;