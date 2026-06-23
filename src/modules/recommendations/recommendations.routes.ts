import { Router } from "express";
import { getRecommendations } from "./recommendations.controller";
import authMiddleware from "../../middlewares/auth.middleware";
import asyncHandler from "../../utils/asyncHandler";

const router = Router();

/**
 * @swagger
 * /api/recommendations:
 *   get:
 *     summary: Obter recomendações personalizadas para o usuário
 *     description: Retorna uma lista de álbuns recomendados baseada em filtragem colaborativa (o que usuários similares gostam) ou os populares gerais caso o usuário não tenha histórico.
 *     tags:
 *       - Recomendações
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Quantidade máxima de recomendações a serem retornadas.
 *     responses:
 *       200:
 *         description: Lista de recomendações gerada com sucesso.
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
 *         description: Não autorizado. O token de autenticação está ausente, inválido ou expirado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get("/", authMiddleware, asyncHandler(getRecommendations));

export default router;