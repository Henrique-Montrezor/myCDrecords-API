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
 *     description: Returns recommended albums, trying in order collaborative filtering (people who loved the same albums or favorites), genre affinity (genres the user rates highest) and platform-wide popular albums. `perfil` tells how many reviews and favorites the user has, so clients can ask for reviews when there is nothing to base suggestions on.
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
 *           maximum: 50
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
 *                   enum: [colaborativa, genero, popular, vazio]
 *                   example: "colaborativa"
 *                 perfil:
 *                   type: object
 *                   properties:
 *                     reviews:
 *                       type: integer
 *                       example: 3
 *                     favorites:
 *                       type: integer
 *                       example: 2
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