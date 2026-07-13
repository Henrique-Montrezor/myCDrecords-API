import { Router } from "express";
import { searchUsers } from "./user.controller";
import asyncHandler from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /api/user/search-users:
 *   get:
 *     summary: Search for users by username
 *     tags: [Users]
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

router.get('/search-users', asyncHandler(searchUsers));

export default router;