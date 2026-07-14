import { Router } from "express";
import { getAlbumById, getAlbumInfo, searchAlbums, getTrendingAlbums } from "./album.controller";

const router = Router();

/**
 * @swagger
 * /api/albums/trending:
 *   get:
 *     summary: Fetch trending albums of the current year
 *     tags: [Albums]
 *     responses:
 *       200:
 *         description: List of trending albums
 */
router.get("/trending", getTrendingAlbums); 

/**
 * @swagger
 * /api/albums/search:
 *   get:
 *     summary: Search albums
 *     tags: [Albums]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         example: Nevermind
 *     responses:
 *       200:
 *         description: List of albums
 */

router.get("/search", searchAlbums);

/**
 * @swagger
 * /api/albums/info:
 *   get:
 *     summary: Fetch album information
 *     tags: [Albums]
 *     parameters:
 *       - in: query
 *         name: name
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
 * /api/albums/{id}:
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