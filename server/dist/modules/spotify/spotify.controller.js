"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchSpotifyController = searchSpotifyController;
exports.getSpotifyAccessToken = getSpotifyAccessToken;
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
const spotify_service_1 = require("./spotify.service");
const cache = new node_cache_1.default({ stdTTL: 3600 });
const cacheKey = 'spotify_access_token';
async function searchSpotifyController(req, res) {
    const token = await (0, spotify_service_1.getSpotifyHeaders)();
    if (!token) {
        return res.status(500).json({ message: "Não foi possível obter o token de acesso do Spotify" });
    }
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ message: "Query é obrigatório" });
    }
    try {
        const results = await (0, spotify_service_1.searchSpotify)(query, "album");
        res.status(200).json(results);
    }
    catch (error) {
        console.error('Erro ao buscar no Spotify:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}
async function getSpotifyAccessToken(req, res) {
    const token = await (0, spotify_service_1.getSpotifyHeaders)();
    if (!token) {
        return res.status(500).json({ message: "Não foi possível obter o token de acesso do Spotify" });
    }
    try {
        const response = await axios_1.default.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.SPOTIFY_CLIENT_ID || '',
            client_secret: process.env.SPOTIFY_CLIENT_SECRET || ''
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const accessToken = response.data.access_token;
        cache.set(cacheKey, accessToken, response.data.expires_in - 60);
        return accessToken;
    }
    catch (error) {
        console.error("Error fetching Spotify access token:", error);
        throw error;
    }
}
//# sourceMappingURL=spotify.controller.js.map