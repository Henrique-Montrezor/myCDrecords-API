import { Router } from "express";
import { searchAlbums } from "./album.controller";

const router = Router();

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


export default router;