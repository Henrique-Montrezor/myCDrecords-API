import { Router } from 'express';
import { deleteReviewController, getReviewsByAlbumIdController, getReviewsByUserIdController, postReviewController, updateReviewController } from './reviews.controller';
import authMiddleware from '../../middlewares/auth.middleware';
import asyncHandler from '../../utils/asyncHandler';

const router = Router();

/**
 * @swagger
 * /api/reviews/albums/{albumId}/reviews:
 *   get:
 *     summary: Lists the reviews of a specific album
 *     description: Returns a paginated list of reviews made for a given album. Requires authentication.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema:
 *           type: string
 *           description: Numeric or string ID of the album.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Page number for pagination (returns 10 records per page).
 *     responses:
 *       200:
 *         description: List of reviews returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   album_id:
 *                     type: integer
 *                     example: 15
 *                   rating:
 *                     type: integer
 *                     example: 5
 *                   text:
 *                     type: string
 *                     example: "One of the best albums of all time!"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2023-10-27T14:30:00Z"
 *       401:
 *         description: Unauthorized. The authentication token is missing, invalid, or expired.
 *       500:
 *         description: Internal server error.
 */
router.get('/albums/:albumId/reviews', authMiddleware, asyncHandler(getReviewsByAlbumIdController));

/**
 * @swagger
 * /api/users/{userId}/reviews:
 *   get:
 *     summary: Lists the user's reviews
 *     description: Returns the reviews made by the selected user.id. Requires authorization.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           description: Numeric or string ID of the user.
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Page number for pagination (returns 10 records per page).
 *     responses:
 *       200:
 *         description: List of reviews returned successfully.
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
 *                   user_id:
 *                     type: integer
 *                     example: 42
 *                   username:
 *                     type: string
 *                     example: "music_user"
 *                   album_id:
 *                     type: integer
 *                     example: 15
 *                   album_title:
 *                     type: string
 *                     example: "Abbey Road"
 *                   album_image:
 *                     type: string
 *                     example: "https://example.com/abbey-road.jpg"
 *                   album_artist:
 *                     type: string
 *                     example: "The Beatles"
 *                   rating:
 *                     type: integer
 *                     example: 5
 *                   text:
 *                     type: string
 *                     example: "One of the best albums of all time!"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                     example: "2023-10-27T14:30:00Z"
 *       401:
 *         description: Unauthorized. The authentication token is missing, invalid, or expired.
 *       500:
 *         description: Internal server error.
 */
router.get('/users/:userId/reviews', authMiddleware, asyncHandler(getReviewsByUserIdController))

/**
 * @swagger
 * /api/reviews/post-review:
 *   post:
 *     summary: Creates a new review for an album
 *     description: Allows an authenticated user to publish a new review with a rating from 1 to 5.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - albumId
 *               - albumTitle
 *               - albumArtist
 *               - rating
 *             properties:
 *               albumId:
 *                 type: string
 *                 description: Album ID
 *                 example: "3mH6qwIy9crq0I9YQbOuDf"
 *               rating:
 *                 type: integer
 *                 description: Review rating (must be between 1 and 5)
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               text:
 *                 type: string
 *                 description: Review text (Optional)
 *                 example: "An absolute classic! Flawless production."
 *     responses:
 *       201:
 *         description: Review created successfully.
 *       400:
 *         description: Validation error. May occur due to missing required fields or a rating out of range.
 *       401:
 *         description: Unauthorized. The authentication token is missing or invalid.
 *       500:
 *         description: Internal server error.
 */
router.post('/post-review', authMiddleware, asyncHandler(postReviewController));

/**
 * @swagger
 * /api/reviews/{reviewId}/delete:
 *   delete:
 *     summary: Deletes a review by ID
 *     description: Allows an authenticated user to delete a specific review.
 *     tags: 
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID of the review to be deleted.
 *     responses:
 *       204:
 *         description: Review deleted successfully. Empty response.
 *       401:
 *         description: Unauthorized. The authentication token is missing or invalid.
 *       500:
 *         description: Internal server error.
 */
router.delete('/:reviewId/delete', authMiddleware, asyncHandler(deleteReviewController))

/**
 * @swagger
 * /api/reviews/{reviewId}/update:
 *   put:
 *     summary: Updates a review by ID
 *     description: Allows an authenticated user to update a specific review.
 *     tags:
 *       - Reviews
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: integer
 *           description: ID of the review to be updated.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: integer
 *                 description: Review rating (must be between 1 and 5)
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               text:
 *                 type: string
 *                 description: Review text (Optional)
 *                 example: "An absolute classic! Flawless production."
 *     responses:
 *       200:
 *         description: Review updated successfully.
 *       400:
 *         description: Validation error. May occur due to a rating out of range or invalid fields.
 *       401:
 *         description: Unauthorized. The authentication token is missing or invalid.
 *       404:
 *         description: Review not found.
 *       500:
 *         description: Internal server error.
 */
router.put('/:reviewId/update', authMiddleware, asyncHandler(updateReviewController));

export default router;