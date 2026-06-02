"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAlbums = searchAlbums;
exports.getAlbumInfo = getAlbumInfo;
exports.getAlbumById = getAlbumById;
const musicbrainz_service_1 = require("../musicbrainz/musicbrainz.service");
const spotify_service_1 = require("../spotify/spotify.service");
async function searchAlbums(req, res) {
    const { nome, limite = 10 } = req.query;
    const data = await (0, musicbrainz_service_1.fetchMusicBrainz)("release-group/", {
        query: `release:${nome} AND primarytype:album`,
        limit: limite
    });
    try {
        const limitNumber = Number(limite) || 10;
        const spotifySearch = await (0, spotify_service_1.searchSpotifyAlbum)(nome, undefined, limitNumber);
        const albums = spotifySearch.albums?.items ?? [];
        res.json({ spotify: albums, musicbrainz: data });
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao buscar álbuns" });
    }
}
;
async function getAlbumInfo(req, res) {
    const queryName = req.query.nome || req.params.name;
    if (!queryName)
        return res.status(400).json({ message: "nome é obrigatório" });
    const musicbrainzData = await (0, musicbrainz_service_1.fetchMusicBrainz)("release-group/", {
        query: `release:${queryName} AND primarytype:album`,
        limit: 1
    });
    try {
        const spotifySearch = await (0, spotify_service_1.searchSpotifyAlbum)(queryName);
        const albumData = spotifySearch.albums?.items?.[0] ?? null;
        res.json({ spotify: albumData, musicbrainz: musicbrainzData });
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao buscar informações do álbum" });
    }
}
;
async function getAlbumById(req, res) {
    const albumId = req.params.id;
    const limit = 1;
    if (!albumId)
        return res.status(400).json({ message: "id é obrigatório" });
    try {
        const albumData = await (0, spotify_service_1.fetchAlbumFromSpotify)(albumId);
        res.json(albumData);
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao buscar informações do álbum" });
    }
}
;
//# sourceMappingURL=album.controller.js.map