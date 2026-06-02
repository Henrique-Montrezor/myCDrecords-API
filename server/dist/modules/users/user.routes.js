"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("./user.controller");
const user_controller_2 = require("./user.controller");
const user_controller_3 = require("./user.controller");
const asyncHandler_1 = __importDefault(require("../../utils/asyncHandler"));
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/user/search-users:
 *   get:
 *     summary: Search for users by username
 *     tags: [Usuários]
 *     parameters:
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
 *         description: The username to search for
 *     responses:
 *       200:
 *         description: A list of users matching the search criteria
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
 *                   username:
 *                     type: string
 *                     example: johndoe
 *                   email:
 *                     type: string
 *                     example: johndoe@example.com
 *       500:
 *        description: Error searching for users
 *
 *
 *
 */
router.get('/search-users', (0, asyncHandler_1.default)(user_controller_2.searchUsers));
/**
 * @swagger
 * /api/user/create-user:
 *   post:
 *     summary: Criar um novo usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               is_active:
 *                 type: boolean
 *                 example: true
 *             required:
 *               - username
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       500:
 *         description: Erro ao criar usuário
 */
// Route to create a new user
router.post('/create-user', (0, asyncHandler_1.default)(user_controller_1.RegisterUser));
/**
 * @swagger
 * /api/user/login:
 *   post:
 *     summary: Login de usuário
 *     tags: [Usuários]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login bem-sucedido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     username:
 *                       type: string
 *                       example: johndoe
 *                     email:
 *                       type: string
 *                       example: johndoe@example.com
 *       400:
 *         description: Dados de login inválidos
 *       500:
 *         description: Erro ao processar login
 */
router.post('/login', (0, asyncHandler_1.default)(user_controller_3.loginUser));
/**
 * @swagger
 * /api/user/logout:
 *   post:
 *     summary: Logout de usuário
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Logout bem-sucedido
 *       500:
 *         description: Erro ao processar logout
 */
router.post('/logout', (0, asyncHandler_1.default)(user_controller_1.logoutUser));
exports.default = router;
//# sourceMappingURL=user.routes.js.map