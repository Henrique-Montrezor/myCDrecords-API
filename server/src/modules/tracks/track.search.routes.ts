import { Router } from "express";
import { searchTracks } from "./track.controller";

const router = Router();

/**
 * @swagger
 * /api/musicas/buscar:
 *   get:
 *     summary: Buscar músicas
 *     tags: [Músicas]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Smells Like Teen Spirit
 *     responses:
 *       200:
 *         description: Lista de músicas
 */
router.get("/buscar", searchTracks);

export default router;