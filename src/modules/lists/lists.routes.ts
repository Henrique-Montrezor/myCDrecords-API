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
 *   - name: Lists
 *     description: Custom album collections/lists
 */

/**
 * @swagger
 * /api/lists:
 *   post:
 *     summary: Create a new list
 *     tags: [Lists]
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
 *         description: List created
 *       401:
 *         description: Not authenticated
 */
router.post("/", authMiddleware, asyncHandler(createListController));

/**
 * @swagger
 * /api/lists/me:
 *   get:
 *     summary: Lists the authenticated user's lists
 *     tags: [Lists]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User's lists
 */
router.get("/me", authMiddleware, asyncHandler(myListsController));

/**
 * @swagger
 * /api/lists/user/{userId}:
 *   get:
 *     summary: Lists a user's public lists
 *     tags: [Lists]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Public lists
 */
router.get("/user/:userId", asyncHandler(userListsController));

/**
 * @swagger
 * /api/lists/{listId}:
 *   get:
 *     summary: Details a list with its items
 *     tags: [Lists]
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List with items
 *       403:
 *         description: Private list
 *       404:
 *         description: List not found
 *   put:
 *     summary: Updates a list
 *     tags: [Lists]
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
 *         description: List updated
 *       404:
 *         description: List not found or access denied
 *   delete:
 *     summary: Removes a list
 *     tags: [Lists]
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
 *         description: List removed
 *       404:
 *         description: List not found or access denied
 */
router.get("/:listId", asyncHandler(getListController));
router.put("/:listId", authMiddleware, asyncHandler(updateListController));
router.delete("/:listId", authMiddleware, asyncHandler(deleteListController));

/**
 * @swagger
 * /api/lists/{listId}/items:
 *   post:
 *     summary: Adds an album to the list
 *     tags: [Lists]
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
 *         description: Album added
 *       409:
 *         description: Album is already in the list
 */
router.post("/:listId/items", authMiddleware, asyncHandler(addListItemController));

/**
 * @swagger
 * /api/lists/{listId}/items/{albumId}:
 *   delete:
 *     summary: Removes an album from the list
 *     tags: [Lists]
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
 *         description: Album removed
 *       404:
 *         description: Album not found in the list
 */
router.delete("/:listId/items/:albumId", authMiddleware, asyncHandler(removeListItemController));

export default router;
