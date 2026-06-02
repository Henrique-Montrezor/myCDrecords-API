"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const artist_controller_1 = require("./artist.controller");
const artist_controller_name_1 = require("./artist.controller.name");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/artistas/buscar:
 *   get:
 *     summary: Buscar artistas pelo nome
 *     tags: [Artistas]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Nirvana
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           maximum: 100
 *         example: 10
 *     responses:
 *       200:
 *         description: Lista de artistas encontrada
 */
router.get("/buscar", artist_controller_1.searchArtists);
/**
 * @swagger
 * /api/artistas/{mbid}:
 *   get:
 *     summary: Obter detalhes de um artista
 *     tags: [Artistas]
 *     parameters:
 *       - in: path
 *         name: mbid
 *         required: true
 *         schema:
 *           type: string
 *         example: 5b11f4ce-a62d-471e-81fc-a69a8278c7da
 *       - in: query
 *         name: incluir_albuns
 *         schema:
 *           type: boolean
 *         example: true
 *     responses:
 *       200:
 *         description: Detalhes do artista
 */
router.get("/:mbid", artist_controller_1.getArtist);
router.get("/buscar-por-nome", artist_controller_name_1.getArtistByName);
exports.default = router;
//# sourceMappingURL=artist.routes.js.map