import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import {
    listBadgesController,
    myBadgesController,
    userBadgesController,
} from "./gamification.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Gamification
 *     description: Badges and achievements from reviews
 */

/**
 * @swagger
 * /api/gamification/badges:
 *   get:
 *     summary: Catalog of available badges
 *     tags: [Gamification]
 *     responses:
 *       200:
 *         description: List of badges
 */
router.get("/badges", asyncHandler(listBadgesController));

/**
 * @swagger
 * /api/gamification/me/badges:
 *   get:
 *     summary: Badges earned by the authenticated user
 *     tags: [Gamification]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User badges
 *       401:
 *         description: Not authenticated
 */
router.get("/me/badges", authMiddleware, asyncHandler(myBadgesController));

/**
 * @swagger
 * /api/gamification/users/{userId}/badges:
 *   get:
 *     summary: Badges earned by a user
 *     tags: [Gamification]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User badges
 */
router.get("/users/:userId/badges", asyncHandler(userBadgesController));

export default router;
