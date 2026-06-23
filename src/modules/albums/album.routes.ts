import { Router } from "express";
import { getAlbumById, getAlbumInfo, searchAlbums, getTrendingAlbums } from "./album.controller";

const router = Router();

router.get("/em-alta", getTrendingAlbums); 

/**
 * @swagger
 * /api/albuns/buscar:
 *   get:
 *     summary: Buscar álbuns
 *     tags: [Álbuns]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nevermind
 *     responses:
 *       200:
 *         description: Lista de álbuns
 */

router.get("/buscar", searchAlbums);

/**
 * @swagger
 * /api/albuns/info:
 *   get:
 *     summary: Buscar informações de um álbum
 *     tags: [Álbuns]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nevermind
 *     responses:
 *       200:
 *         description: Informações do álbum
 */
router.get("/info", getAlbumInfo);

/**
 * @swagger
 * /api/albuns/:id:
 *   get:
 *     summary: Buscar informações de um álbum
 *     tags: [Álbuns]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         example: 123456789
 *     responses:
 *       200:
 *         description: Informações do álbum pelo ID
 */
router.get("/:id", getAlbumById);


export default router;