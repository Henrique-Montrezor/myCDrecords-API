import { Router } from "express";
import { searchArtists, getArtist } from "./artist.controller";
import { getArtistByName } from "./artist.controller.name";

const router = Router();

/**
 * @swagger
 * /api/artistas/buscar:
 *   get:
 *     summary: Search artists by name
 *     tags: [Artists]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nirvana
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           maximum: 100
 *         example: 10
 *     responses:
 *       200:
 *         description: List of artists found
 */

router.get("/buscar", searchArtists);

/**
 * @swagger
 * /api/artistas/{mbid}:
 *   get:
 *     summary: Get details of an artist
 *     tags: [Artists]
 *     parameters:
 *       - in: path
 *         name: mbid
 *         required: true
 *         schema:
 *           type: string
 *         example: 5b11f4ce-a62d-471e-81fc-a69a8278c7da
 *       - in: query
 *         name: incluir_albuns
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Artist details
 */
router.get("/:mbid", getArtist);

router.get("/buscar-por-nome", getArtistByName);

export default router;