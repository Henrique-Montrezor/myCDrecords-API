import { Router } from 'express';
import { deleteReviewController, getAlbumRatingSummaryController, getMyAlbumReviewController, getReviewsByAlbumIdController, getReviewsByUserIdController, postReviewController, updateReviewController } from './reviews.controller';
import authMiddleware from '../../middlewares/auth.middleware';
import asyncHandler from '../../utils/asyncHandler';
import { deleteCommentController, listCommentsController, postCommentController, updateCommentController } from './comments.controller';

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
 * /api/reviews/albums/{albumId}/summary:
 *   get:
 *     summary: Rating average and distribution of an album
 *     description: Returns `average` (null when there are no reviews), total `count` and the number of reviews per star. Requires authentication.
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
 *     responses:
 *       200:
 *         description: Rating summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 average: { type: number, nullable: true, example: 4.3 }
 *                 count: { type: integer, example: 12 }
 *                 distribution:
 *                   type: object
 *                   example: { "1": 0, "2": 1, "3": 2, "4": 4, "5": 5 }
 *       401:
 *         description: Unauthorized.
 */
router.get('/albums/:albumId/summary', authMiddleware, asyncHandler(getAlbumRatingSummaryController));

/**
 * @swagger
 * /api/reviews/albums/{albumId}/mine:
 *   get:
 *     summary: The authenticated user's review of an album
 *     description: Returns the review (with `score` and `user_vote`) or `null` when the user has not reviewed the album.
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
 *     responses:
 *       200:
 *         description: Review or null
 *       401:
 *         description: Unauthorized.
 */
router.get('/albums/:albumId/mine', authMiddleware, asyncHandler(getMyAlbumReviewController));

/**
 * @swagger
 * /api/reviews/users/{userId}/reviews:
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

/**
 * @swagger
 * /api/reviews/{reviewId}/comments:
 *   get:
 *     summary: Lists the comments of a review
 *     description: Oldest first, 20 per page. Each item has `id`, `review_id`, `user_id`, `username`, `avatar_url`, `text`, `created_at`, `updated_at`.
 *     tags: [Comments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: integer } }
 *       - { in: query, name: page, required: false, schema: { type: integer, default: 1 } }
 *     responses:
 *       200: { description: Array of comments }
 *       400: { description: Invalid reviewId or page }
 *       401: { description: Unauthorized }
 *       404: { description: Review not found }
 *   post:
 *     summary: Comments on a review
 *     tags: [Comments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: reviewId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       201: { description: The created comment }
 *       400: { description: Empty or too long text }
 *       401: { description: Unauthorized }
 *       404: { description: Review not found }
 */
router.get('/:reviewId/comments', authMiddleware, asyncHandler(listCommentsController));
router.post('/:reviewId/comments', authMiddleware, asyncHandler(postCommentController));

/**
 * @swagger
 * /api/reviews/comments/{commentId}:
 *   put:
 *     summary: Edits an own comment
 *     tags: [Comments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: commentId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, minLength: 1, maxLength: 1000 }
 *     responses:
 *       200: { description: The updated comment }
 *       400: { description: Empty or too long text }
 *       401: { description: Unauthorized }
 *       404: { description: Comment not found or not owned by the user }
 *   delete:
 *     summary: Deletes an own comment
 *     description: Admins remove any comment via DELETE /api/admin/comments/{id}.
 *     tags: [Comments]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: path, name: commentId, required: true, schema: { type: integer } }
 *     responses:
 *       204: { description: Deleted }
 *       401: { description: Unauthorized }
 *       404: { description: Comment not found or not owned by the user }
 */
router.put('/comments/:commentId', authMiddleware, asyncHandler(updateCommentController));
router.delete('/comments/:commentId', authMiddleware, asyncHandler(deleteCommentController));

export default router;