import {Response, Request} from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import {getSpotifyHeaders, searchSpotify} from './spotify.service';

const cache = new NodeCache({ stdTTL: 3600 });
const cacheKey = 'spotify_access_token';

export async function searchSpotifyController(req: Request, res: Response) {
    const token = await getSpotifyHeaders();
    if (!token) {
        return res.status(500).json({ message: "Não foi possível obter o token de acesso do Spotify" });
    }

    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Query é obrigatório" });
    }

    try {
        const results = await searchSpotify(query as string, "album");
        res.status(200).json(results);
    } catch (error) {
        console.error('Erro ao buscar no Spotify:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
}

export async function getSpotifyAccessToken(req: Request, res: Response) {
    const token = await getSpotifyHeaders();
    if (!token) {
        return res.status(500).json({ message: "Não foi possível obter o token de acesso do Spotify" });
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
    }

    catch (error) {
        console.error("Error fetching Spotify access token:", error);
        throw error;
    }
}