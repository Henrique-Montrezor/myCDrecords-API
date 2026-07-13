import {Response, Request} from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';
import {fetchAlbumFromSpotify, setSpotifyHeaders, searchSpotify, fetchSpotifyPlaylistById, getSpotifyUserProfile, fetchUserTopTracksWithToken, fetchUserTopArtistsWithToken} from './spotify.service';
import crypto from 'crypto'; 
import jwt from 'jsonwebtoken';
import { findOAuthUser, storeOAuthProvider, updateSpotifyTokens, getSpotifyTokens } from '../auth/auth.repository';
import { createUser, findByEmail, findById } from '../users/user.repository';
import { createTokensPair } from '../auth/auth.service';
import { logger } from '../../utils/logger';


const cache = new NodeCache({ stdTTL: 3600 });
const cacheKey = 'spotify_access_token';

// Helper to extract error message from Axios
function getSpotifyErrorMessage(error: any): { status: number; message: string } {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status || 500;
        const spotifyError = error.response?.data?.error;
        
        if (spotifyError) {
            return {
                status,
                message: spotifyError.message || spotifyError.status || 'Error fetching data from Spotify'
            };
        }
        
        if (status === 404) {
            return { status: 404, message: 'Resource not found on Spotify' };
        }
        if (status === 401 || status === 403) {
            return { status: 401, message: 'Invalid or expired Spotify token' };
        }
        if (status === 429) {
            return { status: 429, message: 'Spotify request limit reached. Please try again in a few moments.' };
        }
    }
    
    return { status: 500, message: 'Internal server error' };
}

export async function getUserSpotifyToken(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    try {
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ 
                message: "User does not have Spotify access connected",
                connected: false
            });
        }

        // Check if the token has expired
        const expiresAt = new Date(spotifyTokens.spotify_token_expires_at);
        const now = new Date();
        
        res.status(200).json({
            accessToken: spotifyTokens.spotify_access_token,
            expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
            connected: true
        });
    } catch (error) {
        logger.error("Error getting user Spotify token", { error });
        res.status(500).json({ message: "Error getting Spotify token" });
    }
}

export async function searchSpotifyController(req: Request, res: Response) {
    const token = await setSpotifyHeaders();
    if (!token) {
        return res.status(500).json({ message: "Could not obtain the Spotify access token" });
    }

    const { query } = req.query;

    if (!query) {
        return res.status(400).json({ message: "Query is required" });
    }

    try {
        const results = await searchSpotify(query as string, "album");
        res.status(200).json(results);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error('Error searching on Spotify', { error });
        res.status(status).json({ message });
    }
}

export async function getSpotifyAccessToken(req: Request, res: Response) {
    const token = await setSpotifyHeaders();
    if (!token) {
        return res.status(500).json({ message: "Could not obtain the Spotify access token" });
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
        logger.error("Error fetching Spotify access token", { error });
        throw error;
    }
}

export async function getSpotifyAlbumById(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID is required" });
    }

    try {
        const album = await fetchAlbumFromSpotify(id);
        res.status(200).json(album);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error("Error fetching album from Spotify", { error });
        res.status(status).json({ message });
    }
}

export async function getSpotifyPlaylistById(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "ID is required" });
    }

    try {
        const playlist = await fetchSpotifyPlaylistById(id);
        res.status(200).json(playlist);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error("Error fetching playlist from Spotify", { error });
        res.status(status).json({ message });
     }
}

export async function getTopArtists(req: Request, res: Response) {
    const userId = req.user?.id;
    const { timeRange = 'medium_term', limit = '20' } = req.query;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    try {
        // Get the user's Spotify token
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ message: "User does not have Spotify access connected" });
        }

        const artists = await fetchUserTopArtistsWithToken(
            spotifyTokens.spotify_access_token,
            timeRange as string,
            Number(limit as string)
        );
        res.status(200).json(artists);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error("Error fetching user's top artists from Spotify", { error });
        res.status(status).json({ message });
    }
}

export async function fetchTopTracks(req: Request, res: Response) {
    const userId = req.user?.id;
    const { timeRange = 'medium_term', limit = '20' } = req.query;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    try {
        // Get the user's Spotify token
        const spotifyTokens = await getSpotifyTokens(userId);
        
        if (!spotifyTokens?.spotify_access_token) {
            return res.status(401).json({ message: "User does not have Spotify access connected" });
        }

        const tracks = await fetchUserTopTracksWithToken(
            spotifyTokens.spotify_access_token,
            timeRange as string,
            Number(limit as string)
        );
        res.status(200).json(tracks);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error("Error fetching user's top tracks from Spotify", { error });
        res.status(status).json({ message });
    }
}

export async function fetchSpotifyPlaylist(req: Request, res: Response) {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ message: "Playlist ID is required" });
    }

    try {
        const playlist = await fetchSpotifyPlaylistById(id);
        res.status(200).json(playlist);
    } catch (error) {
        const { status, message } = getSpotifyErrorMessage(error);
        logger.error("Error fetching playlist from Spotify", { error });
        res.status(status).json({ message });
    }
}

export function loginUserSpotify(req: Request, res: Response) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3004/api/spotify/callback';
    
    // 1. Defensive validation
    if (!clientId) {
        return res.status(500).json({ error: 'SPOTIFY_CLIENT_ID not configured on the server.' });
    }

    // 2. Generate the state for security (CSRF)
    const state = crypto.randomBytes(16).toString('hex');
    
    // 3. Save the state in cookies to verify in the callback (lasts 10 minutes)
    res.cookie('spotify_auth_state', state, { httpOnly: true, maxAge: 600000 });

    const scopes = 'user-top-read';

    // 4. Build the URL including the state
    const authUrl = `https://accounts.spotify.com/authorize?` + 
        `response_type=code` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}` +
        // Force the Spotify consent screen even when the user has already
        // authorized the app before (otherwise Spotify redirects directly).
        `&show_dialog=true`;

    // 5. Response
    // When called via XHR (fetch/axios with Accept: application/json), the session
    // token comes through the Authorization header and the frontend does the redirect.
    // This avoids depending on cookies in cross-site navigation (localhost x 127.0.0.1).
    if (req.headers.accept?.includes('application/json')) {
        return res.json({ url: authUrl });
    }

    res.redirect(authUrl);
}

export async function spotifyCallback(req: Request, res: Response) {
    const code = (req.query.code as string) || null;
    const state = (req.query.state as string) || null;
    const storedState = req.cookies ? req.cookies['spotify_auth_state'] : null;

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3004/api/spotify/callback';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 1. Security validation (CSRF)
    if (state === null || state !== storedState) {
        return res.redirect(`${frontendUrl}/dashboard?error=state_mismatch`);
    }

    // Clear the state cookie after validation
    res.clearCookie('spotify_auth_state');

    // 2. Validation of environment variables and the received code
    if (!clientId || !clientSecret) {
        logger.error('Spotify configuration missing on the server.');
        return res.redirect(`${frontendUrl}/dashboard?error=server_config_error`);
    }

    if (!code) {
        return res.redirect(`${frontendUrl}/dashboard?error=no_code`);
    }

    try {
        // 3. Exchange the authorization code for the Access Token
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
            logger.error('Failed to obtain Spotify token', { tokenData });
            return res.redirect(`${frontendUrl}/auth?error=token_exchange_failed`);
        }

        const { access_token, refresh_token, expires_in } = tokenData;

        // 4. Fetch the user's data from Spotify
        let spotifyUser;
        try {
            spotifyUser = await getSpotifyUserProfile(access_token);
        } catch (error) {
            logger.error('Error fetching Spotify profile', { error });
            return res.redirect(`${frontendUrl}/auth?error=profile_fetch_failed`);
        }

        const spotifyId = spotifyUser.id;
        const spotifyEmail = spotifyUser.email;
        const spotifyUsername = spotifyUser.display_name || spotifyUser.id;

        // 5. Find or create the user in the database
        let user;

        // 5.0. PRIORITY: if an active myCDrecords session already exists, Spotify is
        // just an account *connection*. Link the tokens to the logged-in user instead
        // of resolving/creating another user by the Spotify email (which may
        // differ from the registration email). This avoids the case where the
        // callback writes the tokens to one user and the session reads from another
        // (resulting in "connected successfully" but without an actual connection).
        const sessionToken = req.cookies?.token;
        if (sessionToken) {
            try {
                const decoded: any = jwt.verify(
                    sessionToken,
                    process.env.JWT_REFRESH_SECRET || 'your-refresh-secret'
                );
                const sessionUser = await findById(decoded.user_id);
                if (sessionUser) {
                    user = sessionUser;
                }
            } catch {
                // Invalid/expired session — proceed to the Spotify login flow.
            }
        }

        // Next, try to find via OAuth (only if there is no session).
        if (!user) {
            user = await findOAuthUser('spotify', spotifyId);
        }

        if (!user) {
            // If there is no OAuth link, try to find by email
            if (spotifyEmail) {
                user = await findByEmail(spotifyEmail);
            }

            // If no user exists with that email, create a new one
            if (!user) {
                // Generate a unique username based on Spotify
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
                    logger.error('Error creating user', { error });
                    return res.redirect(`${frontendUrl}/auth?error=user_creation_failed`);
                }
            }
        }

        // Ensure the OAuth link (idempotent) for the resolved user.
        try {
            await storeOAuthProvider(user.id, 'spotify', spotifyId);
        } catch (error) {
            logger.error('Error storing OAuth provider', { error });
            // Do not fail here, continue with authentication
        }

        // 6. Store the Spotify tokens
        try {
            await updateSpotifyTokens(
                user.id,
                access_token,
                refresh_token,
                expires_in
            );
        } catch (error) {
            // Connecting Spotify is precisely about persisting these tokens; if it fails,
            // it makes no sense to report success. Redirect with an explicit error.
            logger.error('Error storing Spotify tokens', { error });
            return res.redirect(`${frontendUrl}/dashboard?error=token_store_failed`);
        }

        // 7. Generate JWT tokens for the mycdrecords user
        try {
            const tokensPair = await createTokensPair(user.id, user.email);

            // 8. Return tokens securely via cookies and URL
            res.cookie('accessToken', tokensPair.accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 15 * 60 * 1000 // 15 minutes
            });

            res.cookie('refreshToken', tokensPair.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Redirect to the dashboard with success information
            return res.redirect(`${frontendUrl}/dashboard?spotify=success`);
        } catch (error) {
            logger.error('Error generating JWT tokens', { error });
            return res.redirect(`${frontendUrl}/dashboard?error=jwt_generation_failed`);
        }

    } catch (error) {
        logger.error('Error in the Spotify callback', { error });
        return res.redirect(`${frontendUrl}/dashboard?error=internal_server_error`);
    }
}