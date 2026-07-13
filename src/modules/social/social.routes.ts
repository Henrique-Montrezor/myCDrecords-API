import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import {
    followController,
    unfollowController,
    followersController,
    followingController,
    feedController,
    voteController,
    removeVoteController,
    voteScoreController,
} from "./social.controller";

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Social
 *     description: Followers and votes (up/downvotes)
 */

/**
 * @swagger
 * /api/social/feed:
 *   get:
 *     summary: Feed of reviews from followed users
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of reviews
 *       401:
 *         description: Not authenticated
 */
router.get("/feed", authMiddleware, asyncHandler(feedController));

/**
 * @swagger
 * /api/social/vote:
 *   post:
 *     summary: Records or updates a vote on a review or comment
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId, value]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [review, comment]
 *               targetId:
 *                 type: integer
 *               value:
 *                 type: integer
 *                 enum: [1, -1]
 *     responses:
 *       200:
 *         description: Vote recorded
 *       401:
 *         description: Not authenticated
 *   delete:
 *     summary: Removes the user's vote on a target
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [review, comment]
 *               targetId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Vote removed
 *       404:
 *         description: Vote not found
 */
router.post("/vote", authMiddleware, asyncHandler(voteController));
router.delete("/vote", authMiddleware, asyncHandler(removeVoteController));

/**
 * @swagger
 * /api/social/votes/{targetType}/{targetId}:
 *   get:
 *     summary: Vote score of a target
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: targetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [review, comment]
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Aggregate score
 */
router.get("/votes/:targetType/:targetId", asyncHandler(voteScoreController));

/**
 * @swagger
 * /api/social/follow/{userId}:
 *   post:
 *     summary: Follow a user
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       201:
 *         description: User followed
 *       409:
 *         description: Already following this user
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Social]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Unfollowed
 *       404:
 *         description: Not following this user
 */
router.post("/follow/:userId", authMiddleware, asyncHandler(followController));
router.delete("/follow/:userId", authMiddleware, asyncHandler(unfollowController));

/**
 * @swagger
 * /api/social/{userId}/followers:
 *   get:
 *     summary: Lists a user's followers
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of followers
 */
router.get("/:userId/followers", asyncHandler(followersController));

/**
 * @swagger
 * /api/social/{userId}/following:
 *   get:
 *     summary: Lists who the user follows
 *     tags: [Social]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of followed users
 */
router.get("/:userId/following", asyncHandler(followingController));

export default router;
