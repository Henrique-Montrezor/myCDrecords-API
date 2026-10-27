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
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: offset
 *         description: Number of results to skip (pagination). Applied to Spotify and MusicBrainz.
 *         schema: { type: integer, default: 0, minimum: 0, maximum: 1000 }
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
 *     summary: Fetch album details with tracklist
 *     description: Accepts a Spotify album ID or a MusicBrainz release-group MBID and always returns the same shape.
 *     tags: [Albums]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 2UJcKiJxNryhL050F5Z1Fk
 *     responses:
 *       200:
 *         description: Album details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 source: { type: string, enum: [spotify, musicbrainz] }
 *                 title: { type: string }
 *                 artists: { type: array, items: { type: object, properties: { name: { type: string } } } }
 *                 releaseDate: { type: string, nullable: true }
 *                 type: { type: string, nullable: true, example: album }
 *                 coverUrl: { type: string, nullable: true }
 *                 genres: { type: array, items: { type: string } }
 *                 externalUrl: { type: string, nullable: true }
 *                 totalTracks: { type: integer }
 *                 tracks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       number: { type: integer }
 *                       discNumber: { type: integer }
 *                       title: { type: string }
 *                       durationMs: { type: integer, nullable: true }
 *                       artists: { type: array, items: { type: string } }
 *       404:
 *         description: Album not found or ID not recognized by any provider
 *       502:
 *         description: Provider (Spotify or MusicBrainz) failed
 */
router.get("/:id", getAlbumById);


export default router;