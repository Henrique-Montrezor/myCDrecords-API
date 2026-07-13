import {Router} from 'express';
import {
  searchSpotifyController,
  getSpotifyAlbumById,
  getSpotifyPlaylistById,
  fetchSpotifyPlaylist,
  getTopArtists,
  fetchTopTracks,
  getUserSpotifyToken,
  loginUserSpotify,
  spotifyCallback
} from './spotify.controller';
import authMiddleware from '../../middlewares/auth.middleware';

const router = Router();

/**
 * @swagger
 * /api/spotify/search:
 *   get:
 *     summary: Search albums on Spotify
 *     tags: [Spotify]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         example: The Beatles
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/search', searchSpotifyController);

/**
 * @swagger
 * /api/spotify/albums/{id}:
 *   get:
 *     summary: Get album by ID
 *     tags: [Spotify]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 3mH6qwIy9crq0I9YQbOuDf
 *     responses:
 *       200:
 *         description: Album found
 */
router.get('/albums/:id', getSpotifyAlbumById);

/**
 * @swagger
 * /api/spotify/playlists/{id}:
 *   get:
 *     summary: Get playlist by ID
 *     tags: [Spotify]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 5SpJ0l6821947890123456
 *     responses:
 *       200:
 *         description: Playlist found
 */
router.get('/playlists/:id', getSpotifyPlaylistById);

/**
 * @swagger
 * /api/spotify/playlist/{id}:
 *   get:
 *     summary: Get playlist by ID (alias)
 *     tags: [Spotify]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 5SpJ0l6821947890123456
 *     responses:
 *       200:
 *         description: Playlist found
 */
router.get('/playlist/:id', fetchSpotifyPlaylist);

/**
 * @swagger
 * /api/spotify/top-artists:
 *   get:
 *     summary: Get the user's top artists
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [short_term, medium_term, long_term]
 *           default: medium_term
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Top artists found
 *       401:
 *         description: Not authenticated
 */
router.get('/top-artists', authMiddleware, getTopArtists);

/**
 * @swagger
 * /api/spotify/top/artists:
 *   get:
 *     summary: Get the user's top artists (alternative route)
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [short_term, medium_term, long_term]
 *           default: medium_term
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Top artists found
 *       401:
 *         description: Not authenticated
 */
router.get('/top/artists', authMiddleware, getTopArtists);

/**
 * @swagger
 * /api/spotify/top-tracks:
 *   get:
 *     summary: Get the user's top tracks
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [short_term, medium_term, long_term]
 *           default: medium_term
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Top tracks found
 *       401:
 *         description: Not authenticated
 */
router.get('/top-tracks', authMiddleware, fetchTopTracks);

/**
 * @swagger
 * /api/spotify/user-token:
 *   get:
 *     summary: Get the Spotify token of the authenticated user
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Spotify token returned successfully
 *       401:
 *         description: User not authenticated or without Spotify connected
 */
router.get('/user-token', authMiddleware, getUserSpotifyToken);

/**
 * @swagger
 * /api/spotify/login-spotify:
 *   get:
 *     summary: Start the Spotify login process
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Spotify login URL returned
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */
router.get('/login-spotify', authMiddleware, loginUserSpotify);

/**
 * @swagger
 * /api/spotify/callback:
 *   get:
 *     summary: Callback of the Spotify login process
 *     tags: [Spotify]
 *     responses:
 *       200:
 *         description: Login process completed successfully
 */
router.get('/callback', spotifyCallback);

export default router;