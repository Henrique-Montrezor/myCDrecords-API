import {createOrUpdateProfileController, deleteProfileImageController, getActivityController, getFavoritesController, replaceFavoritesController, uploadProfileImageController} from "./profile.controller";
import { MAX_IMAGE_BYTES } from "./profile.images";
import {searchProfileByUsername} from "./profile.controller";
import { Router } from "express";
import express from "express";
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
 * /api/profile/get-profile/{username}:
 *   get:
 *     summary: Get a user's public profile by username
 *     description: Returns `id`, `username`, `bio`, `avatar_url`, `followers`, `following`, `reviews`, `is_following` and `is_self`.
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: username
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Username
 *     responses:
 *       200:
 *         description: Profile found
 *       401:
 *         description: User not authenticated
 *       404:
 *         description: Profile not found
 */
router.get('/get-profile/:username', authmiddleware, asyncHandler(searchProfileByUsername));

/**
 * @swagger
 * /api/profile/users/{userId}/favorites:
 *   get:
 *     summary: Favorite albums of a user (up to four)
 *     description: Returns the albums that define the user, ordered by `position` (1 to 4).
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of `{ position, album_id, album_title, album_image, album_artist }`
 *       401:
 *         description: User not authenticated
 */
router.get('/users/:userId/favorites', authmiddleware, asyncHandler(getFavoritesController));

/**
 * @swagger
 * /api/profile/favorites:
 *   put:
 *     summary: Replace the authenticated user's favorite albums
 *     description: Sets up to four albums. Array order defines the slot. Send an empty array to clear.
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
 *             required:
 *               - albums
 *             properties:
 *               albums:
 *                 type: array
 *                 maxItems: 4
 *                 items:
 *                   type: object
 *                   required:
 *                     - albumId
 *                   properties:
 *                     albumId: { type: string }
 *                     albumTitle: { type: string }
 *                     albumImage: { type: string }
 *                     albumArtist: { type: string }
 *     responses:
 *       200:
 *         description: The saved favorites
 *       400:
 *         description: More than four albums, duplicates or invalid fields
 *       401:
 *         description: User not authenticated
 */
router.put('/favorites', authmiddleware, asyncHandler(replaceFavoritesController));

/**
 * @swagger
 * /api/profile/users/{userId}/activity:
 *   get:
 *     summary: Recent activity of a user
 *     description: Reviews written (`type` = review) and reviews from other people the user liked (`type` = like, with `author_username`), newest first, 10 per page.
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of activity entries
 *       401:
 *         description: User not authenticated
 */
router.get('/users/:userId/activity', authmiddleware, asyncHandler(getActivityController));

const imageBody = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_IMAGE_BYTES });

/**
 * @swagger
 * /api/profile/{kind}:
 *   post:
 *     summary: Upload the authenticated user's avatar or banner
 *     description: '`kind` is `avatar` or `banner`. Send the raw image as the body (`Content-Type` image/jpeg, image/png or image/webp, up to 2 MB). The file signature is validated. Returns the public `url`.'
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: kind
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatar, banner]
 *     requestBody:
 *       required: true
 *       content:
 *         image/jpeg: { schema: { type: string, format: binary } }
 *         image/png: { schema: { type: string, format: binary } }
 *         image/webp: { schema: { type: string, format: binary } }
 *     responses:
 *       200:
 *         description: Image saved, `{ url }`
 *       400:
 *         description: Empty body
 *       413:
 *         description: Image larger than 2 MB
 *       415:
 *         description: Unsupported image type
 *   delete:
 *     summary: Remove the authenticated user's avatar or banner
 *     tags:
 *       - Profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: kind
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [avatar, banner]
 *     responses:
 *       204:
 *         description: Image removed
 */
router.post('/:kind(avatar|banner)', authmiddleware, imageBody, asyncHandler(uploadProfileImageController));
router.delete('/:kind(avatar|banner)', authmiddleware, asyncHandler(deleteProfileImageController));

export default router;