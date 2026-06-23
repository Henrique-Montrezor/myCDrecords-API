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
    const cacheKey = `spotify-album-${albumId}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await setSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/albums/${albumId}`, {
            headers,
            timeout: 10000
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching album from Spotify:", error);
        throw error;
    }
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
        const headers = await setSpotifyHeaders();
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
        const headers = await setSpotifyHeaders();
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
        const headers = await setSpotifyHeaders();
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

export async function setSpotifyHeaders() {
    const token = await getSpotifyAccessToken();
    return ({
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
    });
}

export async function fetchSpotifyPlaylistById(playlistId: string) {
    const cacheKey = `spotify-playlist-${playlistId}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await setSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/playlists/${playlistId}`, { headers });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching playlist from Spotify:", error);
        throw error;
    }
}

export async function fetchUserTopTracks(userId: string, timeRange: string = 'medium_term', limit: number = 20) {
    const cacheKey = `spotify-top-tracks-${userId}-${timeRange}-${limit}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await setSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/me/top/tracks`, {
            headers,
            params: {
                time_range: timeRange,
                limit
            }     
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching user's top tracks from Spotify:", error);
        throw error;
    } 
}

export async function fetchUserTopArtists(userId: string, timeRange: string = 'medium_term', limit: number = 20) {
    const cacheKey = `spotify-top-artists-${userId}-${timeRange}-${limit}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await setSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/me/top/artists`, {
            headers,
            params: {
                time_range: timeRange,
                limit 
            }     
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching user's top artists from Spotify:", error);
        throw error;
    }
}

export async function exchangeCodeForToken(code: string) {
    const cacheKey = `spotify-user-token-${code}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    try {       
            const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3004/api/spotify/callback',
            client_id: process.env.SPOTIFY_CLIENT_ID || '',
            client_secret: process.env.SPOTIFY_CLIENT_SECRET || ''
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error exchanging code for Spotify token:", error);
        throw error;
    }
}

// Get Spotify user profile using user's access token
export async function getSpotifyUserProfile(accessToken: string) {
    try {
        const response = await axios.get(`${BASE_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching Spotify user profile:", error);
        throw error;
    }
}

// Fetch user's top tracks using user's access token
export async function fetchUserTopTracksWithToken(accessToken: string, timeRange: string = 'medium_term', limit: number = 20) {
    try {
        const response = await axios.get(`${BASE_URL}/me/top/tracks`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                time_range: timeRange,
                limit
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching user's top tracks from Spotify:", error);
        throw error;
    }
}

// Fetch user's top artists using user's access token
export async function fetchUserTopArtistsWithToken(accessToken: string, timeRange: string = 'medium_term', limit: number = 20) {
    try {
        const response = await axios.get(`${BASE_URL}/me/top/artists`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            params: {
                time_range: timeRange,
                limit
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching user's top artists from Spotify:", error);
        throw error;
    }
}

export async function fetchNewReleases(limit = 12) {
    const cacheKey = `spotify-new-releases-${limit}`;
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    try {
        const headers = await setSpotifyHeaders();
        const response = await axios.get(`${BASE_URL}/browse/new-releases`, {
            headers,
            timeout: 10000,
            params: { limit }
        });
        cache.set(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error("Error fetching new releases from Spotify:", error);
        throw error;
    }
}