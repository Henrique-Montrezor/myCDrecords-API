"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpotifyAccessToken = getSpotifyAccessToken;
exports.fetchAlbumFromSpotify = fetchAlbumFromSpotify;
exports.searchSpotifyAlbum = searchSpotifyAlbum;
exports.fetchArtistFromSpotify = fetchArtistFromSpotify;
exports.searchSpotify = searchSpotify;
exports.fetchalbumcover = fetchalbumcover;
exports.getSpotifyHeaders = getSpotifyHeaders;
const axios_1 = __importDefault(require("axios"));
const cache_1 = require("../../utils/cache");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BASE_URL = "https://api.spotify.com/v1";
async function getSpotifyAccessToken() {
    const cacheKey = "spotify-access-token";
    const cachedToken = cache_1.cache.get(cacheKey);
    if (cachedToken) {
        return cachedToken;
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
        cache_1.cache.set(cacheKey, accessToken, response.data.expires_in - 60);
        return accessToken;
    }
    catch (error) {
        console.error("Error fetching Spotify access token:", error);
        throw error;
    }
}
async function fetchAlbumFromSpotify(albumId) {
    const cacheKey = `spotify-album-${albumId}`;
    const cached = cache_1.cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        const headers = await getSpotifyHeaders();
        const response = await axios_1.default.get(`${BASE_URL}/albums/${albumId}`, {
            headers,
            timeout: 10000
        });
        cache_1.cache.set(cacheKey, response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching Spotify album by ID:", error);
        throw error;
    }
}
async function searchSpotifyAlbum(albumName, artist, limit = 10) {
    const query = `album:${albumName}${artist ? ` artist:${artist}` : ''}`;
    const searchResult = await searchSpotify(query, 'album', limit);
    return searchResult;
}
async function fetchArtistFromSpotify(artistId) {
    const cacheKey = `spotify-artist-${artistId}`;
    const cached = cache_1.cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        const headers = await getSpotifyHeaders();
        const response = await axios_1.default.get(`${BASE_URL}/artists/${artistId}`, {
            headers,
            timeout: 10000
        });
        cache_1.cache.set(cacheKey, response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error fetching artist from Spotify:", error);
        throw error;
    }
}
async function searchSpotify(query, type, limit = 10) {
    const cacheKey = `spotify-search-${type}-${query}-${limit}`;
    const cached = cache_1.cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        const headers = await getSpotifyHeaders();
        const response = await axios_1.default.get(`${BASE_URL}/search`, {
            headers,
            timeout: 10000,
            params: {
                q: query,
                type,
                limit
            }
        });
        cache_1.cache.set(cacheKey, response.data);
        return response.data;
    }
    catch (error) {
        console.error("Error searching Spotify:", error);
        throw error;
    }
}
async function fetchalbumcover(trackId) {
    const cachekey = `spotify-album-cover-${trackId}`;
    const cached = cache_1.cache.get(cachekey);
    if (cached)
        return cached;
    try {
        const headers = await getSpotifyHeaders();
        const response = await axios_1.default.get(`${BASE_URL}/tracks/${trackId}`, {
            headers,
            timeout: 10000,
        });
        const albumCover = response.data.album.images[0]?.url || null;
        cache_1.cache.set(cachekey, albumCover);
        return albumCover;
    }
    catch (error) {
        console.error("Error fetching album cover from Spotify:", error);
        throw error;
    }
}
async function getSpotifyHeaders() {
    const token = await getSpotifyAccessToken();
    return ({
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
    });
}
//# sourceMappingURL=spotify.service.js.map