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
 *     summary: Buscar álbuns no Spotify
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
 *         description: Resultados da busca
 */
router.get('/search', searchSpotifyController);

/**
 * @swagger
 * /api/spotify/albums/{id}:
 *   get:
 *     summary: Buscar álbum por ID
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
 *         description: Álbum encontrado
 */
router.get('/albums/:id', getSpotifyAlbumById);

/**
 * @swagger
 * /api/spotify/playlists/{id}:
 *   get:
 *     summary: Buscar playlist por ID
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
 *         description: Playlist encontrada
 */
router.get('/playlists/:id', getSpotifyPlaylistById);

/**
 * @swagger
 * /api/spotify/playlist/{id}:
 *   get:
 *     summary: Buscar playlist por ID (alias)
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
 *         description: Playlist encontrada
 */
router.get('/playlist/:id', fetchSpotifyPlaylist);

/**
 * @swagger
 * /api/spotify/top-artists:
 *   get:
 *     summary: Buscar top artistas do usuário
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
 *         description: Top artistas encontrados
 *       401:
 *         description: Não autenticado
 */
router.get('/top-artists', authMiddleware, getTopArtists);

/**
 * @swagger
 * /api/spotify/top/artists:
 *   get:
 *     summary: Buscar top artistas do usuário (rota alternativa)
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
 *         description: Top artistas encontrados
 *       401:
 *         description: Não autenticado
 */
router.get('/top/artists', authMiddleware, getTopArtists);

/**
 * @swagger
 * /api/spotify/top-tracks:
 *   get:
 *     summary: Buscar top tracks do usuário
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
 *         description: Top tracks encontrados
 *       401:
 *         description: Não autenticado
 */
router.get('/top-tracks', authMiddleware, fetchTopTracks);

/**
 * @swagger
 * /api/spotify/user-token:
 *   get:
 *     summary: Obter token do Spotify do usuário autenticado
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token do Spotify retornado com sucesso
 *       401:
 *         description: Usuário não autenticado ou sem Spotify conectado
 */
router.get('/user-token', authMiddleware, getUserSpotifyToken);

/**
 * @swagger
 * /api/spotify/login-spotify:
 *   get:
 *     summary: Iniciar processo de login no Spotify
 *     tags: [Spotify]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: URL de login do Spotify retornada
 *       401:
 *         description: Não autenticado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/login-spotify', authMiddleware, loginUserSpotify);

/**
 * @swagger
 * /api/spotify/callback:
 *   get:
 *     summary: Callback do processo de login no Spotify
 *     tags: [Spotify]
 *     responses:
 *       200:
 *         description: Processo de login concluído com sucesso
 */
router.get('/callback', spotifyCallback);

export default router;