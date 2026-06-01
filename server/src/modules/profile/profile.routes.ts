import {createOrUpdateProfileController} from "./profile.controller";
import {searchProfileByUsername} from "./profile.controller";
import { Router } from "express";
import asyncHandler from '../../utils/asyncHandler';
import authmiddleware from "../../middlewares/auth.middleware";

const router = Router();

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
router.post('/create-or-update-profile', authmiddleware, asyncHandler(createOrUpdateProfileController));

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
router.get('/get-profile/:userId', authmiddleware, asyncHandler(searchProfileByUsername));

export default router;