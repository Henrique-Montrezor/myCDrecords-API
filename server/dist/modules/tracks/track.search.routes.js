"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const track_controller_1 = require("./track.controller");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/musicas/buscar:
 *   get:
 *     summary: Buscar músicas
 *     tags: [Músicas]
 *     parameters:
 *       - in: query
 *         name: nome
 *         required: true
 *         schema:
 *           type: string
 *         example: Smells Like Teen Spirit
 *     responses:
 *       200:
 *         description: Lista de músicas
 */
router.get("/buscar", track_controller_1.searchTracks);
exports.default = router;
//# sourceMappingURL=track.search.routes.js.map