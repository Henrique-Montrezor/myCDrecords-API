"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const album_controller_1 = require("./album.controller");
const router = (0, express_1.Router)();
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
router.get("/buscar", album_controller_1.searchAlbums);
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
router.get("/info", album_controller_1.getAlbumInfo);
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
router.get("/:id", album_controller_1.getAlbumById);
exports.default = router;
//# sourceMappingURL=album.routes.js.map