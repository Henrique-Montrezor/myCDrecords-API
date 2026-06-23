import { Router } from 'express';
import { deleteReviewController, getReviewsByAlbumIdController, getReviewsByUserIdController, postReviewController, updateReviewController } from './reviews.controller';
import authMiddleware from '../../middlewares/auth.middleware';
import asyncHandler from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /api/reviews/albums/{albumId}/reviews:
 *   get:
 *     summary: Lista as avaliações de um álbum específico
 *     description: Retorna uma lista paginada de avaliações (reviews) feitas para um determinado álbum. Requer autenticação.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           description: ID numérico ou string do álbum.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Número da página para a paginação (traz 10 registros por página).
 *     responses:
 *       200:
 *         description: Lista de avaliações retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   album_id:
 *                     type: integer
 *                     example: 15
 *                   rating:
 *                     type: integer
 *                     example: 5
 *                   text:
 *                     type: string
 *                     example: "Um dos melhores álbuns de todos os tempos!"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2023-10-27T14:30:00Z"
 *       401:
 *         description: Não autorizado. O token de autenticação está ausente, inválido ou expirado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get('/albums/:albumId/reviews', authMiddleware, asyncHandler(getReviewsByAlbumIdController));

/**
 * @swagger
 * /api/users/:userId/reviews
 *   get:
 *     summary: Lista as reviews do usuario
 *     description: Retorna as reviews feitas pelo user.id selecionado. Requer Autorizacao.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           description: ID numérico ou string do usuario.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Número da página para a paginação (traz 10 registros por página).
 *     responses:
 *       200:
 *         description: Lista de avaliações retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 1
 *                   user_id:
 *                     type: integer
 *                     example: 42
 *                   username:
 *                     type: string
 *                     example: "usuario_musical"
 *                   album_id:
 *                     type: integer
 *                     example: 15
 *                   album_title:
 *                     type: string
 *                     example: "Abbey Road"
 *                   album_image:
 *                     type: string
 *                     example: "https://exemplo.com/abbey-road.jpg"
 *                   album_artist:
 *                     type: string
 *                     example: "The Beatles"
 *                   rating:
 *                     type: integer
 *                     example: 5
 *                   text:
 *                     type: string
 *                     example: "Um dos melhores álbuns de todos os tempos!"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2023-10-27T14:30:00Z"
 *       401:
 *         description: Não autorizado. O token de autenticação está ausente, inválido ou expirado.
 *       500:
 *         description: Erro interno do servidor.
 */
router.get('/users/:userId/reviews', authMiddleware, asyncHandler(getReviewsByUserIdController))

/**
 * @swagger
 * /api/reviews/post-review:
 *   post:
 *     summary: Cria uma nova avaliação para um álbum
 *     description: Permite que um usuário autenticado publique uma nova avaliação (review) com uma nota de 1 a 5.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - albumId
 *               - albumTitle
 *               - albumArtist
 *               - rating
 *             properties:
 *               albumId:
 *                 type: string
 *                 description: ID do álbum
 *                 example: "3mH6qwIy9crq0I9YQbOuDf"
 *               rating:
 *                 type: integer
 *                 description: Nota da avaliação (deve ser entre 1 e 5)
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               text:
 *                 type: string
 *                 description: Texto da avaliação (Opcional)
 *                 example: "Um clássico absoluto! Produção impecável."
 *     responses:
 *       201:
 *         description: Avaliação criada com sucesso.
 *       400:
 *         description: Erro de validação. Pode ocorrer por falta de campos obrigatórios ou nota fora do padrão.
 *       401:
 *         description: Não autorizado. O token de autenticação está ausente ou inválido.
 *       500:
 *         description: Erro interno do servidor.
 */
router.post('/post-review', authMiddleware, asyncHandler(postReviewController));

/**
 * @swagger
 * /api/reviews/{reviewId}/delete:
 *   delete:
 *     summary: Deleta uma avaliação pelo ID
 *     description: Permite que um usuário autenticado exclua uma avaliação específica.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID da avaliação a ser excluída.
 *     responses:
 *       204:
 *         description: Avaliação excluída com sucesso. Resposta vazia.
 *       401:
 *         description: Não autorizado. O token de autenticação está ausente ou inválido.
 *       500:
 *         description: Erro interno do servidor.
 */
router.delete('/:reviewId/delete', authMiddleware, asyncHandler(deleteReviewController))

/**
 * @swagger
 * /api/reviews/{reviewId}/update:
 *   put:
 *     summary: Atualiza uma avaliação pelo ID
 *     description: Permite que um usuário autenticado atualize uma avaliação específica.
 *     tags:
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID da avaliação a ser atualizada.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 description: Nota da avaliação (deve ser entre 1 e 5)
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               text:
 *                 type: string
 *                 description: Texto da avaliação (Opcional)
 *                 example: "Um clássico absoluto! Produção impecável."
 *     responses:
 *       200:
 *         description: Avaliação atualizada com sucesso.
 *       400:
 *         description: Erro de validação. Pode ocorrer por nota fora do padrão ou campos inválidos.
 *       401:
 *         description: Não autorizado. O token de autenticação está ausente ou inválido.
 *       404:
 *         description: Avaliação não encontrada.
 *       500:
 *         description: Erro interno do servidor.
 */
router.put('/:reviewId/update', authMiddleware, asyncHandler(updateReviewController));

export default router;