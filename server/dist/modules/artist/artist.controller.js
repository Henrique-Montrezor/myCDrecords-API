"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchArtists = searchArtists;
exports.getArtist = getArtist;
const musicbrainz_service_1 = require("../musicbrainz/musicbrainz.service");
// GET /artistas?nome=xxx&limite=10
async function searchArtists(req, res) {
    const { nome, limite = 10 } = req.query;
    const data = await (0, musicbrainz_service_1.fetchMusicBrainz)("artist/", {
        query: `artist:"${nome}"`,
        limit: limite
    });
    res.json(data);
}
// GET /artistas/:mbid
async function getArtist(req, res) {
    const { mbid } = req.params;
    const { incluir_albuns } = req.query;
    const params = {};
    if (incluir_albuns === "true") {
        params.inc = "release-groups";
    }
    const data = await (0, musicbrainz_service_1.fetchMusicBrainz)(`artist/${mbid}`, params);
    res.json(data);
}
//# sourceMappingURL=artist.controller.js.map