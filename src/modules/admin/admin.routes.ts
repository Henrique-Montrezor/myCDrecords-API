import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import adminMiddleware from "./admin.middleware";
import { publishDiscoverySelection, importDiscoveryAlbum } from "../albums/album.selection";
import {
  listUsers,
  banUserHandler,
  unbanUserHandler,
  deleteReviewHandler,
  deleteCommentHandler,
  listReports,
} from "./admin.controller";

const router = Router();

// Middleware: requires authentication and admin permission
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * @swagger
 * /api/admin/discovery/selection:
 *   put:
 *     summary: Atomically replace the manual discovery selection
 *     description: Existing administrators only. Read the current revision at GET /api/albums/discover/selection first. The first item is the lead pick. Empty items explicitly unpublishes all picks. Every MBID must already exist in the local catalog; no external calls are made by publication.
 *     tags: [Admin]
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [revision, items]
 *             additionalProperties: false
 *             properties:
 *               revision: { type: integer, minimum: 0 }
 *               items:
 *                 type: array
 *                 maxItems: 6
 *                 items:
 *                   type: object
 *                   additionalProperties: false
 *                   required: [albumId, note]
 *                   properties:
 *                     albumId: { type: string, format: uuid, description: MusicBrainz release-group MBID }
 *                     note: { type: string, minLength: 1, maxLength: 800 }
 *     responses:
 *       200:
 *         description: Published revision
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [revision]
 *               properties:
 *                 revision: { type: integer }
 *       400:
 *         description: Invalid input, repeated MBID or more than 6 picks
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Existing admin permission required
 *       404:
 *         description: A requested album is not in the local MusicBrainz catalog
 *       409:
 *         description: Revision conflict; reload before publishing
 *       500:
 *         description: Database failure; transaction rolled back
 * /api/admin/discovery/catalog/{albumId}:
 *   post:
 *     summary: Import or refresh one MusicBrainz release-group for curation
 *     description: Fetches one group, preserves source identity and normalizes tags. Does not publish it, merge editions or query Spotify.
 *     tags: [Admin]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Imported albumId and source
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 albumId: { type: string, format: uuid }
 *                 source: { type: string, enum: [musicbrainz] }
 *       400:
 *         description: Invalid MBID
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Existing admin permission required
 *       404:
 *         description: Unknown MusicBrainz release-group
 *       502:
 *         description: Provider unavailable or invalid response
 *       503:
 *         description: Local catalog unavailable
 */
router.put("/discovery/selection", asyncHandler(publishDiscoverySelection));
router.post("/discovery/catalog/:albumId", asyncHandler(importDiscoveryAlbum));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List users
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Users listed successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 */
router.get("/users", asyncHandler(listUsers));

/**
 * @swagger
 * /api/admin/users/{id}/ban:
 *   patch:
 *     summary: Ban user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: User banned successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Access denied
 */
router.patch("/users/:id/ban", asyncHandler(banUserHandler));

/**
 * @swagger
 * /api/admin/users/{id}/unban:
 *   patch:
 *     summary: Unban user
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: User unbanned successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Access denied
 */
router.patch("/users/:id/unban", asyncHandler(unbanUserHandler));

/**
 * @swagger
 * /api/admin/reviews/{id}:
 *   delete:
 *     summary: Delete review
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Access denied
 */
router.delete("/reviews/:id", asyncHandler(deleteReviewHandler));

/**
 * @swagger
 * /api/admin/comments/{id}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *       400:
 *         description: Invalid data
 *       403:
 *         description: Access denied
 */
router.delete("/comments/:id", asyncHandler(deleteCommentHandler));

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: List reports
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, investigating, resolved, dismissed]
 *     responses:
 *       200:
 *         description: Reports listed successfully
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Access denied
 */
router.get("/reports", asyncHandler(listReports));

export default router;
