import { Router } from "express";
import { getAlbumById, getAlbumInfo, searchAlbums, getTrendingAlbums } from "./album.controller";

const router = Router();

router.get("/em-alta", getTrendingAlbums); 

/**
 * @swagger
 * /api/albuns/buscar:
 *   get:
 *     summary: Search albums
 *     tags: [Albums]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nevermind
 *     responses:
 *       200:
 *         description: List of albums
 */

router.get("/buscar", searchAlbums);

/**
 * @swagger
 * /api/albuns/info:
 *   get:
 *     summary: Fetch album information
 *     tags: [Albums]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nevermind
 *     responses:
 *       200:
 *         description: Album information
 */
router.get("/info", getAlbumInfo);

/**
 * @swagger
 * /api/albuns/:id:
 *   get:
 *     summary: Fetch album information
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 123456789
 *     responses:
 *       200:
 *         description: Album information by ID
 */
router.get("/:id", getAlbumById);


export default router;