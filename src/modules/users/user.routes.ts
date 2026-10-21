import { Router } from "express";
import { searchUsers } from "./user.controller";
import asyncHandler from '../../utils/asyncHandler';
import authMiddleware from "../../middlewares/auth.middleware";

const router = Router();

/**
 * @swagger
 * /api/user/search-users:
 *   get:
 *     summary: Search users by username prefix
 *     description: Requires authentication. Returns only `id`, `username` and `avatar_url` (at most 10 results).
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Username prefix
 *     responses:
 *       200:
 *         description: Matching users
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
 *                   avatar_url:
 *                     type: string
 *                     nullable: true
 *       400:
 *         description: Invalid query
 *       401:
 *         description: Not authenticated
 */

router.get('/search-users', authMiddleware, asyncHandler(searchUsers));

export default router;