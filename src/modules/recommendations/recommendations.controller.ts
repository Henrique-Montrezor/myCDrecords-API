import { Request, Response } from "express";
import { cache } from "../../utils/cache";
import { getCollaborativeRecommendations, getPopularRecommendations } from "./recommendations.repository";
import { logger } from "../../utils/logger";

export async function getRecommendations(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    // Usando seu utilitário de cache nativo
    const cacheKey = `recommendations_${userId}_${limit}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        let recomendacoes = await getCollaborativeRecommendations(userId, limit);
        let tipo = "colaborativa";

        // Lógica de Cold Start
        if (recomendacoes.length === 0) {
            recomendacoes = await getPopularRecommendations(userId, limit);
            tipo = "popular";
            
            // Se a plataforma for nova e não tiver NADA popular, retorna array vazio limpo
            if (recomendacoes.length === 0) {
                return res.status(200).json({ tipo: "vazio", data: [] });
            }
        }

        const respostaFinal = {
            tipo,
            data: recomendacoes
        };

        // Salva no cache por 1 hora (3600 segundos)
        cache.set(cacheKey, respostaFinal, 3600);

        res.status(200).json(respostaFinal);
    } catch (error) {
        logger.error("Erro ao buscar recomendações", { error });
        res.status(500).json({ message: "Erro interno do servidor ao gerar recomendações" });
    }
}