import axios from "axios";
import { cache } from "../../utils/cache";
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = "https://api.spotify.com/v1";

export async function getSpotifyAccessToken() {
    const cacheKey = "spotify-access-token";
    const cachedToken = cache.get(cacheKey);

    if (cachedToken) {
        return cachedToken;
    }

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
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
    } catch (error) {
        console.error("Error fetching Spotify access token:", error);
        throw error;
    }
}

export async function fetchAlbumFromSpotify(albumId: string) {
    const query = `id:${albumId}`;
    const searchResult = await searchSpotify(query, 'album', 1);
    return searchResult;

}

export async function searchSpotifyAlbum(albumName: string, artist?: string, limit = 10) {
    const query = `album:${albumName}${artist ? ` artist:${artist}` : ''}`;
    const searchResult = await searchSpotify(query, 'album', limit);
    return searchResult;
}

export async function fetchArtistFromSpotify(artistId: string) {
    const cacheKey = `spotify-artist-${artistId}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await getSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/artists/${artistId}`, {
            headers,
            timeout: 10000
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching artist from Spotify:", error);
        throw error;
    }  
}

export async function searchSpotify(query: string, type: string, limit = 10) {
    const cacheKey = `spotify-search-${type}-${query}-${limit}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await getSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/search`, {
            headers,
            timeout: 10000,
            params: {
                q: query,
                type,
                limit
            }
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error searching Spotify:", error);
        throw error;
    }
}

export async function fetchalbumcover(trackId: string) {
    const cachekey = `spotify-album-cover-${trackId}`;
    const cached = cache.get(cachekey);

    if (cached) return cached;

    try {
        const headers = await getSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/tracks/${trackId}`, {
            headers,
            timeout: 10000,
        });
        const albumCover = response.data.album.images[0]?.url || null;
        cache.set(cachekey, albumCover);
        return albumCover;
    } catch (error) {
        console.error("Error fetching album cover from Spotify:", error);
        throw error;
    }
}

export async function getSpotifyHeaders() {
    const token = await getSpotifyAccessToken();
    return ({
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
    });
}