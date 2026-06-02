"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchTracks = searchTracks;
const musicbrainz_service_1 = require("../musicbrainz/musicbrainz.service");
const spotify_service_1 = require("../spotify/spotify.service");
async function searchTracks(req, res) {
    const queryName = (req.query.nome || req.query.name);
    if (!queryName)
        return res.status(400).json({ message: "nome é obrigatório" });
    const musicbrainzData = await (0, musicbrainz_service_1.fetchMusicBrainz)("recording/", {
        query: `recording:"${queryName}"`,
        limit: Number(10)
    });
    const results = await Promise.all(musicbrainzData.recordings.map(async (recording) => {
        const artist = recording["artist-credit"]?.[0]?.name;
        const query = `${recording.title} ${artist || ""}`;
        const spotifyData = await (0, spotify_service_1.searchSpotify)(query, "track");
        const spotifyTrack = spotifyData.tracks?.items?.[0];
        return {
            musicbrainz: recording,
            spotify: {
                id: spotifyTrack?.id,
                name: spotifyTrack?.name,
                album: spotifyTrack?.album?.name,
                image: spotifyTrack?.album?.images?.[0]?.url || null,
                artists: spotifyTrack?.artists?.map((a) => a.name)
            }
        };
    }));
    res.json(results);
}
//# sourceMappingURL=track.controller.js.map