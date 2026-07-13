import { Request, Response } from "express";
import { cache } from "../../utils/cache";
import { getCollaborativeRecommendations, getPopularRecommendations } from "./recommendations.repository";
import { logger } from "../../utils/logger";

export async function getRecommendations(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    // Using the native cache utility
    const cacheKey = `recommendations_${userId}_${limit}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        let recomendacoes = await getCollaborativeRecommendations(userId, limit);
        let tipo = "colaborativa";

        // Cold Start logic
        if (recomendacoes.length === 0) {
            recomendacoes = await getPopularRecommendations(userId, limit);
            tipo = "popular";
            
            // If the platform is new and has NOTHING popular, return a clean empty array
            if (recomendacoes.length === 0) {
                return res.status(200).json({ tipo: "vazio", data: [] });
            }
        }

        const respostaFinal = {
            tipo,
            data: recomendacoes
        };

        // Save in cache for 1 hour (3600 seconds)
        cache.set(cacheKey, respostaFinal, 3600);

        res.status(200).json(respostaFinal);
    } catch (error) {
        logger.error("Error fetching recommendations", { error });
        res.status(500).json({ message: "Internal server error while generating recommendations" });
    }
}