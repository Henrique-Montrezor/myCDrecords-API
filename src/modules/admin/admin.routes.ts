import { Router } from "express";
import asyncHandler from "../../utils/asyncHandler";
import authMiddleware from "../../middlewares/auth.middleware";
import adminMiddleware from "./admin.middleware";
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
router.get("/users", adminMiddleware, asyncHandler(listUsers));

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
router.patch("/users/:id/ban", adminMiddleware, asyncHandler(banUserHandler));

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
router.patch("/users/:id/unban", adminMiddleware, asyncHandler(unbanUserHandler));

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
router.delete("/reviews/:id", adminMiddleware, asyncHandler(deleteReviewHandler));

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
router.delete("/comments/:id", adminMiddleware, asyncHandler(deleteCommentHandler));

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
router.get("/reports", adminMiddleware, asyncHandler(listReports));

export default router;
