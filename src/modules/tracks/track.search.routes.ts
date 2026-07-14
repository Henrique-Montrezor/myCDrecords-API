import { Router } from "express";
import { searchTracks } from "./track.controller";

const router = Router();

/**
 * @swagger
 * /api/tracks/search:
 *   get:
 *     summary: Search tracks
 *     tags: [Tracks]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: Smells Like Teen Spirit
 *     responses:
 *       200:
 *         description: List of tracks
 */
router.get("/search", searchTracks);

export default router;