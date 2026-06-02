"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const profile_controller_1 = require("./profile.controller");
const profile_controller_2 = require("./profile.controller");
const express_1 = require("express");
const asyncHandler_1 = __importDefault(require("../../utils/asyncHandler"));
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/profile/create-or-update-profile:
 *   post:
 *     summary: Criar ou atualizar o perfil do usuário autenticado
 *     tags:
 *       - Perfil
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *                 example: "Amante de CDs"
 *               avatar_url:
 *                 type: string
 *                 example: "http://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Perfil criado ou atualizado com sucesso
 *       401:
 *         description: Usuário não autenticado
 */
router.post('/create-or-update-profile', auth_middleware_1.default, (0, asyncHandler_1.default)(profile_controller_1.createOrUpdateProfileController));
/**
 * @swagger
 * /api/profile/get-profile/{userId}:
 *   get:
 *     summary: Obter perfil do usuário pelo ID
 *     tags:
 *       - Perfil
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Perfil encontrado
 *       401:
 *         description: Usuário não autenticado
 *       404:
 *         description: Perfil não encontrado
 */
router.get('/get-profile/:userId', auth_middleware_1.default, (0, asyncHandler_1.default)(profile_controller_2.searchProfileByUsername));
exports.default = router;
//# sourceMappingURL=profile.routes.js.map