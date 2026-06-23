import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import {
    createListController,
    myListsController,
    userListsController,
    getListController,
    updateListController,
    deleteListController,
    addListItemController,
    removeListItemController,
} from "./lists.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Listas
 *     description: Coleções/listas personalizadas de álbuns
 */

/**
 * @swagger
 * /api/lists:
 *   post:
 *     summary: Cria uma nova lista
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Lista criada
 *       401:
 *         description: Não autenticado
 */
router.post("/", authMiddleware, asyncHandler(createListController));

/**
 * @swagger
 * /api/lists/me:
 *   get:
 *     summary: Lista as listas do usuário autenticado
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Listas do usuário
 */
router.get("/me", authMiddleware, asyncHandler(myListsController));

/**
 * @swagger
 * /api/lists/user/{userId}:
 *   get:
 *     summary: Lista as listas públicas de um usuário
 *     tags: [Listas]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Listas públicas
 */
router.get("/user/:userId", asyncHandler(userListsController));

/**
 * @swagger
 * /api/lists/{listId}:
 *   get:
 *     summary: Detalha uma lista com seus itens
 *     tags: [Listas]
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista com itens
 *       403:
 *         description: Lista privada
 *       404:
 *         description: Lista não encontrada
 *   put:
 *     summary: Atualiza uma lista
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               isPublic:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Lista atualizada
 *       404:
 *         description: Lista não encontrada ou acesso negado
 *   delete:
 *     summary: Remove uma lista
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Lista removida
 *       404:
 *         description: Lista não encontrada ou acesso negado
 */
router.get("/:listId", asyncHandler(getListController));
router.put("/:listId", authMiddleware, asyncHandler(updateListController));
router.delete("/:listId", authMiddleware, asyncHandler(deleteListController));

/**
 * @swagger
 * /api/lists/{listId}/items:
 *   post:
 *     summary: Adiciona um álbum à lista
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [albumId]
 *             properties:
 *               albumId:
 *                 type: string
 *               albumTitle:
 *                 type: string
 *               albumImage:
 *                 type: string
 *               albumArtist:
 *                 type: string
 *               position:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Álbum adicionado
 *       409:
 *         description: Álbum já está na lista
 */
router.post("/:listId/items", authMiddleware, asyncHandler(addListItemController));

/**
 * @swagger
 * /api/lists/{listId}/items/{albumId}:
 *   delete:
 *     summary: Remove um álbum da lista
 *     tags: [Listas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Álbum removido
 *       404:
 *         description: Álbum não encontrado na lista
 */
router.delete("/:listId/items/:albumId", authMiddleware, asyncHandler(removeListItemController));

export default router;
