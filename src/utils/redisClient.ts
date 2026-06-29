import Redis from "ioredis";
import { logger } from "./logger";

let redisClient: Redis | null = null;

/**
 * Retorna um cliente Redis singleton se REDIS_URL estiver definida.
 * Caso contrário retorna null, permitindo que o rate limiter use o store
 * em memória como fallback (sem derrubar a aplicação).
 */
export function getRedisClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    const url = process.env.REDIS_URL;
    if (!url) {
        logger.warn(
            "[redis] REDIS_URL não definida — rate limiting usará store em memória (não distribuído)."
        );
        return null;
    }

    redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
    });

    redisClient.on("error", (err) => {
        logger.error("[redis] Erro de conexão", { error: err.message });
    });

    redisClient.on("connect", () => {
        logger.info("[redis] Conectado.");
    });

    return redisClient;
}
