import {Response, Request} from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import {fetchAlbumFromSpotify, setSpotifyHeaders, searchSpotify, fetchSpotifyPlaylistById, getSpotifyUserProfile, fetchUserTopTracksWithToken, fetchUserTopArtistsWithToken} from './spotify.service';
import crypto from 'crypto'; // Nativo do Node.js
import { findOAuthUser, storeOAuthProvider, updateSpotifyTokens, getSpotifyTokens } from '../auth/auth.repository';
import { createUser, findByEmail, findById } from '../users/user.repository';
import { generateAccessToken, generateRefreshToken, createTokensPair } from '../auth/auth.service';


const cache = new NodeCache({ stdTTL: 3600 });
const cacheKey = 'spotify_access_token';

// Helper para extrair mensagem de erro do Axios
function getSpotifyErrorMessage(error: any): { status: number; message: string } {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const spotifyError = error.response?.data?.error;
        
        if (spotifyError) {
            return {
                status,
                message: spotifyError.message || spotifyError.status || 'Erro ao buscar dados do Spotify'
            };
        }
        
        if (status === 404) {
            return { status: 404, message: 'Recurso não encontrado no Spotify' };
        }
        if (status === 401 || status === 403) {
            return { status: 401, message: 'Token do Spotify inválido ou expirado' };
        }
        if (status === 429) {
            return { status: 429, message: 'Limite de requisições do Spotify atingido. Tente novamente em alguns instantes.' };
        }
    }
    
    return { status: 500, message: 'Erro interno do servidor' };
}

export async function getUserSpotifyToken(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    try {
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ 
                message: "Usuário não tem acesso Spotify conectado",
                connected: false
            });
        }

        // Verificar se o token expirou
        const expiresAt = new Date(spotifyTokens.spotify_token_expires_at);
        const now = new Date();
        
        res.status(200).json({
            accessToken: spotifyTokens.spotify_access_token,
            expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
            connected: true
        });
    } catch (error) {
        console.error("Error getting user Spotify token:", error);
        res.status(500).json({ message: "Erro ao obter token do Spotify" });
    }
}

export async function searchSpotifyController(req: Request, res: Response) {
    const token = await setSpotifyHeaders();
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
        const { status, message } = getSpotifyErrorMessage(error);
        console.error('Erro ao buscar no Spotify:', error);
        res.status(status).json({ message });
    }
}

export async function getSpotifyAccessToken(req: Request, res: Response) {
    const token = await setSpotifyHeaders();
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

export async function getSpotifyAlbumById(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID é obrigatório" });
    }

    try {
        const album = await fetchAlbumFromSpotify(id);
        res.status(200).json(album);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        console.error("Error fetching album from Spotify:", error);
        res.status(status).json({ message });
    }
}

export async function getSpotifyPlaylistById(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID é obrigatório" });
    }

    try {
        const playlist = await fetchSpotifyPlaylistById(id);
        res.status(200).json(playlist);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        console.error("Error fetching playlist from Spotify:", error);
        res.status(status).json({ message });
     }
}

export async function getTopArtists(req: Request, res: Response) {
    const userId = req.user?.id;
    const { timeRange = 'medium_term', limit = '20' } = req.query;

    if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    try {
        // Obter token do Spotify do usuário
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ message: "Usuário não tem acesso Spotify conectado" });
        }

        const artists = await fetchUserTopArtistsWithToken(
            spotifyTokens.spotify_access_token,
            timeRange as string,
            Number(limit as string)
        );
        res.status(200).json(artists);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        console.error("Error fetching user's top artists from Spotify:", error);
        res.status(status).json({ message });
    }
}

export async function fetchTopTracks(req: Request, res: Response) {
    const userId = req.user?.id;
    const { timeRange = 'medium_term', limit = '20' } = req.query;

    if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    try {
        // Obter token do Spotify do usuário
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ message: "Usuário não tem acesso Spotify conectado" });
        }

        const tracks = await fetchUserTopTracksWithToken(
            spotifyTokens.spotify_access_token,
            timeRange as string,
            Number(limit as string)
        );
        res.status(200).json(tracks);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        console.error("Error fetching user's top tracks from Spotify:", error);
        res.status(status).json({ message });
    }
}

export async function fetchSpotifyPlaylist(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID da playlist é obrigatório" });
    }

    try {
        const playlist = await fetchSpotifyPlaylistById(id);
        res.status(200).json(playlist);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        console.error("Error fetching playlist from Spotify:", error);
        res.status(status).json({ message });
    }
}

export function loginUserSpotify(req: Request, res: Response) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';
    
    // 1. Validação defensiva
    if (!clientId) {
        return res.status(500).json({ error: 'SPOTIFY_CLIENT_ID não configurado no servidor.' });
    }

    // 2. Gerar o state para segurança (CSRF)
    const state = crypto.randomBytes(16).toString('hex');
    
    // 3. Salvar o state nos cookies para verificar no callback (dura 10 minutos)
    res.cookie('spotify_auth_state', state, { httpOnly: true, maxAge: 600000 });

    const scopes = 'user-top-read';

    // 4. Montagem da URL incluindo o state
    const authUrl = `https://accounts.spotify.com/authorize?` + 
        `response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}`;

    // 5. Redirecionamento
    res.redirect(authUrl);
}

export async function spotifyCallback(req: Request, res: Response) {
    const code = (req.query.code as string) || null;
    const state = (req.query.state as string) || null;
    const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 1. Validação de Segurança (CSRF)
    if (state === null || state !== storedState) {
        return res.redirect(`${frontendUrl}/auth?error=state_mismatch`);
    }

    // Limpa o cookie de estado após a validação
    res.clearCookie('spotify_auth_state');

    // 2. Validação das variáveis de ambiente e do código recebido
    if (!clientId || !clientSecret) {
        console.error('Configurações do Spotify ausentes no servidor.');
        return res.redirect(`${frontendUrl}/auth?error=server_config_error`);
    }

    if (!code) {
        return res.redirect(`${frontendUrl}/auth?error=no_code`);
    }

    try {
        // 3. Trocar o código de autorização pelo Access Token
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error('Falha ao obter token do Spotify:', tokenData);
            return res.redirect(`${frontendUrl}/auth?error=token_exchange_failed`);
        }

        const { access_token, refresh_token, expires_in } = tokenData;

        // 4. Buscar dados do usuário do Spotify
        let spotifyUser;
        try {
            spotifyUser = await getSpotifyUserProfile(access_token);
        } catch (error) {
            console.error('Erro ao buscar perfil do Spotify:', error);
            return res.redirect(`${frontendUrl}/auth?error=profile_fetch_failed`);
        }

        const spotifyId = spotifyUser.id;
        const spotifyEmail = spotifyUser.email;
        const spotifyUsername = spotifyUser.display_name || spotifyUser.id;

        // 5. Procurar ou criar usuário no banco de dados
        let user;

        // Primeiro, tentar encontrar por OAuth
        user = await findOAuthUser('spotify', spotifyId);

        if (!user) {
            // Se não existe OAuth link, tentar encontrar por email
            if (spotifyEmail) {
                user = await findByEmail(spotifyEmail);
            }

            // Se não existe usuário com esse email, criar novo
            if (!user) {
                // Gerar username único baseado no Spotify
                let username = spotifyUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                let uniqueUsername = username;
                let counter = 1;

                while (await findByEmail(`${uniqueUsername}@spotify.local`)) {
                    uniqueUsername = `${username}_${counter}`;
                    counter++;
                }

                try {
                    user = await createUser({
                        username: uniqueUsername,
                        email: spotifyEmail || `${uniqueUsername}@spotify.local`,
                        password: '', // OAuth users don't have passwords
                        is_active: true
                    } as any);
                } catch (error) {
                    console.error('Erro ao criar usuário:', error);
                    return res.redirect(`${frontendUrl}/auth?error=user_creation_failed`);
                }
            }

            // Agora que temos um user, criar o link OAuth
            try {
                await storeOAuthProvider(user.id, 'spotify', spotifyId);
            } catch (error) {
                console.error('Erro ao armazenar OAuth provider:', error);
                // Não falhar aqui, continuar com autenticação
            }
        }

        // 6. Armazenar tokens do Spotify
        try {
            await updateSpotifyTokens(
                user.id,
                access_token,
                refresh_token,
                expires_in
            );
        } catch (error) {
            console.error('Erro ao armazenar tokens do Spotify:', error);
            // Não falhar aqui, continuar com autenticação
        }

        // 7. Gerar tokens JWT para o usuário mycdrecords
        try {
            const tokensPair = await createTokensPair(user.id, user.email);

            // 8. Retornar tokens de forma segura via cookies e URL
            res.cookie('accessToken', tokensPair.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000 // 15 minutos
            });

            res.cookie('refreshToken', tokensPair.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
            });

            // Redirecionar para o dashboard com informação de sucesso
            return res.redirect(`${frontendUrl}/dashboard?spotify=success`);
        } catch (error) {
            console.error('Erro ao gerar tokens JWT:', error);
            return res.redirect(`${frontendUrl}/auth?error=jwt_generation_failed`);
        }

    } catch (error) {
        console.error('Erro no callback do Spotify:', error);
        return res.redirect(`${frontendUrl}/auth?error=internal_server_error`);
    }
}