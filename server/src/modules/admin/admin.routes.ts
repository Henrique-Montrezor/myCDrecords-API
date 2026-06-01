import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import adminMiddleware from "./admin.middleware";
import {
  listUsers,
  banUserHandler,
  unbanUserHandler,
  deleteReviewHandler,
  deleteCommentHandler,
  listReports,
} from "./admin.controller";

const router = Router();

// Middleware: requer autenticação e permissão de admin
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Listar usuários
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Usuários listados com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 */
router.get("/users", adminMiddleware, asyncHandler(listUsers));

/**
 * @swagger
 * /api/admin/users/{id}/ban:
 *   patch:
 *     summary: Banir usuário
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuário banido com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso negado
 */
router.patch("/users/:id/ban", adminMiddleware, asyncHandler(banUserHandler));

/**
 * @swagger
 * /api/admin/users/{id}/unban:
 *   patch:
 *     summary: Desbanir usuário
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Usuário desbanido com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso negado
 */
router.patch("/users/:id/unban", adminMiddleware, asyncHandler(unbanUserHandler));

/**
 * @swagger
 * /api/admin/reviews/{id}:
 *   delete:
 *     summary: Deletar review
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Review deletada com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso negado
 */
router.delete("/reviews/:id", adminMiddleware, asyncHandler(deleteReviewHandler));

/**
 * @swagger
 * /api/admin/comments/{id}:
 *   delete:
 *     summary: Deletar comentário
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Comentário deletado com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Acesso negado
 */
router.delete("/comments/:id", adminMiddleware, asyncHandler(deleteCommentHandler));

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Listar denúncias
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, resolved, dismissed]
 *     responses:
 *       200:
 *         description: Denúncias listadas com sucesso
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Acesso negado
 */
router.get("/reports", adminMiddleware, asyncHandler(listReports));

export default router;
