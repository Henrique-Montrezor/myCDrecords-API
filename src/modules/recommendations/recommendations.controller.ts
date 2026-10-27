import { Request, Response } from "express";
import { cache } from "../../utils/cache";
import { getCollaborativeRecommendations, getGenreRecommendations, getPopularRecommendations, getTasteProfile } from "./recommendations.repository";
import { logger } from "../../utils/logger";

const CACHE_TTL_SECONDS = 600;

type Recommendations = { tipo: "colaborativa" | "genero" | "popular" | "vazio"; data: unknown[] };

// Called whenever the user's taste signals change (review posted/deleted, favorites saved)
export function clearRecommendationsCache(userId: number) {
    const prefix = `recommendations_${userId}_`;
    cache.del(cache.keys().filter((key) => key.startsWith(prefix)));
}

export async function getRecommendations(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const cacheKey = `recommendations_${userId}_${limit}`;

    try {
        // Taste counters are cheap and must be fresh so the client can ask for reviews right away
        const perfil = await getTasteProfile(userId);

        const cached = cache.get<Recommendations>(cacheKey);
        if (cached) {
            return res.status(200).json({ ...cached, perfil });
        }

        let resposta: Recommendations = { tipo: "colaborativa", data: await getCollaborativeRecommendations(userId, limit) };

        if (resposta.data.length === 0) {
            resposta = { tipo: "genero", data: await getGenreRecommendations(userId, limit) };
        }

        // Cold Start logic
        if (resposta.data.length === 0) {
            resposta = { tipo: "popular", data: await getPopularRecommendations(userId, limit) };
        }

        // If the platform is new and has NOTHING popular, return a clean empty array
        if (resposta.data.length === 0) {
            resposta = { tipo: "vazio", data: [] };
        }

        cache.set(cacheKey, resposta, CACHE_TTL_SECONDS);

        res.status(200).json({ ...resposta, perfil });
    } catch (error) {
        logger.error("Error fetching recommendations", { error });
        res.status(500).json({ message: "Internal server error while generating recommendations" });
    }
}
