import { Router } from "express";
import { searchTracks } from "./track.controller";

const router = Router();

/**
 * @swagger
 * /api/musicas/buscar:
 *   get:
 *     summary: Search tracks
 *     tags: [Tracks]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Smells Like Teen Spirit
 *     responses:
 *       200:
 *         description: List of tracks
 */
router.get("/buscar", searchTracks);

export default router;