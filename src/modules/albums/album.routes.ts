import { Router } from "express";
import { getAlbumById, getAlbumInfo, searchAlbums, getTrendingAlbums } from "./album.controller";
import { discoverAlbums } from "./album.discovery";
import asyncHandler from "../../utils/asyncHandler";
import { readDiscoverySelection } from "./album.selection";

const router = Router();

/**
 * @swagger
 * /api/albums/discover/selection:
 *   get:
 *     summary: Read the manually published discovery selection
 *     description: Independent of the catalog provider. At most 6 entries, in curator order, not a chart or a weekly promise. No selection is seeded automatically.
 *     tags: [Albums]
 *     security: []
 *     responses:
 *       200:
 *         description: Editorial section with provenance, revision and actual publication time; status is empty until published.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [sectionId, kind, title, source, status, revision, updatedAt, curator, items]
 *               properties:
 *                 sectionId: { type: string, enum: [editorial] }
 *                 kind: { type: string, enum: [editorial] }
 *                 title: { type: string }
 *                 source: { type: string, enum: [mycdrecords] }
 *                 status: { type: string, enum: [ready, empty] }
 *                 revision: { type: integer, minimum: 0 }
 *                 updatedAt: { type: string, format: date-time, nullable: true }
 *                 curator: { type: string, nullable: true }
 *                 items:
 *                   type: array
 *                   maxItems: 6
 *                   items:
 *                     type: object
 *                     required: [album, note]
 *                     properties:
 *                       note: { type: string, maxLength: 800 }
 *                       album:
 *                         type: object
 *                         required: [id, source, title, artistCredit, releaseDate, imageUrl]
 *                         properties:
 *                           id: { type: string, format: uuid }
 *                           source: { type: string, enum: [musicbrainz] }
 *                           title: { type: string }
 *                           artistCredit:
 *                             type: array
 *                             items: { type: object, properties: { name: { type: string } } }
 *                           releaseDate: { type: string }
 *                           imageUrl: { type: string }
 *       503:
 *         description: Editorial storage unavailable, with message and requestId
 */
router.get("/discover/selection", asyncHandler(readDiscoverySelection));

/**
 * @swagger
 * /api/albums/discover:
 *   get:
 *     summary: Browse the MusicBrainz catalog by year, type and genre tag
 *     description: Catalog search relevance, not popularity or editorial selection. updatedAt is the server query time (the provider adapter may use cached data). The search window ends at offset 1000.
 *     tags: [Albums]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: genre
 *         schema: { type: string, enum: [rock, pop, jazz, electronic, hip hop, gothic rock, post-punk, darkwave, gothic metal] }
 *       - in: query
 *         name: year
 *         description: First release year, from 1900 through next year; defaults to the current year.
 *         schema: { type: integer, minimum: 1900 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [album, ep, single], default: album }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, minimum: 0, maximum: 1000, default: 0 }
 *     responses:
 *       200:
 *         description: Up to 12 catalog entries. An empty catalog is a successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [source, updatedAt, items, total, nextOffset]
 *               properties:
 *                 source: { type: string, enum: [musicbrainz] }
 *                 updatedAt: { type: string, format: date-time }
 *                 total: { type: integer, minimum: 0 }
 *                 nextOffset: { type: integer, nullable: true }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     required: [id, source, title]
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       source: { type: string, enum: [musicbrainz] }
 *                       title: { type: string }
 *                       releaseDate: { type: string }
 *                       imageUrl: { type: string }
 *                       type: { type: string }
 *                       artistCredit:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name: { type: string }
 *                       genres: { type: array, items: { type: string } }
 *                       tags: { type: array, items: { type: string } }
 *       400:
 *         description: Invalid, repeated or unknown query parameter
 *       502:
 *         description: Unavailable provider or invalid provider response
 *       503:
 *         description: Local catalog persistence unavailable
 */
router.get("/discover", asyncHandler(discoverAlbums));

/**
 * @swagger
 * /api/albums/trending:
 *   get:
 *     summary: Fetch catalog releases of the current year (not a popularity chart)
 *     tags: [Albums]
 *     responses:
 *       200:
 *         description: List of current-year catalog releases
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