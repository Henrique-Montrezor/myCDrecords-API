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
 *     summary: Create or update the authenticated user's profile
 *     tags:
 *       - Profile
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
 *                 example: "CD lover"
 *               avatar_url:
 *                 type: string
 *                 example: "http://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Profile created or updated successfully
 *       401:
 *         description: User not authenticated
 */
router.post('/create-or-update-profile', authmiddleware, asyncHandler(createOrUpdateProfileController));

/**
 * @swagger
 * /api/profile/get-profile/{userId}:
 *   get:
 *     summary: Get a user's profile by ID
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Profile found
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Profile not found
 */
router.get('/get-profile/:userId', authmiddleware, asyncHandler(searchProfileByUsername));

export default router;