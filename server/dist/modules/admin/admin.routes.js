"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const asyncHandler_1 = __importDefault(require("../../utils/asyncHandler"));
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const admin_middleware_1 = __importDefault(require("./admin.middleware"));
const admin_controller_1 = require("./admin.controller");
const router = (0, express_1.Router)();
// Middleware: requer autenticação e permissão de admin
router.use(auth_middleware_1.default);
router.use(admin_middleware_1.default);
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
router.get("/users", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.listUsers));
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
router.patch("/users/:id/ban", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.banUserHandler));
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
router.patch("/users/:id/unban", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.unbanUserHandler));
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
router.delete("/reviews/:id", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.deleteReviewHandler));
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
router.delete("/comments/:id", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.deleteCommentHandler));
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
router.get("/reports", admin_middleware_1.default, (0, asyncHandler_1.default)(admin_controller_1.listReports));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map