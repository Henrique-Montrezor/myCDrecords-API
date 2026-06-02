"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getArtistByName = getArtistByName;
const musicbrainz_service_1 = require("../musicbrainz/musicbrainz.service");
async function getArtistByName(req, res) {
    const { nome } = req.query;
    if (!nome) {
        return res.status(400).json({ error: "Nome é obrigatório" });
    }
    // 1. Buscar artista
    const search = await (0, musicbrainz_service_1.fetchMusicBrainz)("artist/", {
        query: `artist:${nome}`,
        limit: 1
    });
    const artista = search.artists?.[0];
    if (!artista) {
        return res.status(404).json({ error: "Artista não encontrado" });
    }
    // 2. Buscar detalhes usando ID
    const detalhes = await (0, musicbrainz_service_1.fetchMusicBrainz)(`artist/${artista.id}`, {
        inc: "release-groups"
    });
    res.json(detalhes);
}
//# sourceMappingURL=artist.controller.name.js.map