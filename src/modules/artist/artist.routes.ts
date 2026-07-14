import { Router } from "express";
import { searchArtists, getArtist } from "./artist.controller";
import { getArtistByName } from "./artist.controller.name";

const router = Router();

/**
 * @swagger
 * /api/artists/search:
 *   get:
 *     summary: Search artists by name
 *     tags: [Artists]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: Nirvana
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           maximum: 100
 *         example: 10
 *     responses:
 *       200:
 *         description: List of artists found
 */
router.get("/search", searchArtists);

/**
 * @swagger
 * /api/artists/search-by-name:
 *   get:
 *     summary: Search a single artist by name and return its details
 *     tags: [Artists]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: Nirvana
 *     responses:
 *       200:
 *         description: Artist details
 *       404:
 *         description: Artist not found
 */
router.get("/search-by-name", getArtistByName);

/**
 * @swagger
 * /api/artists/{mbid}:
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
 *         name: include_albums
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Artist details
 */
router.get("/:mbid", getArtist);

export default router;