import Redis from "ioredis";
import { logger } from "./logger";

let redisClient: Redis | null = null;

/**
 * Returns a singleton Redis client if REDIS_URL is defined.
 * Otherwise, returns null, allowing the rate limiter to use the in-memory store
 * as a fallback (without crashing the application).
 */
export function getRedisClient(): Redis | null {
    if (redisClient) {
        return redisClient;
    }

    const url = process.env.REDIS_URL;
    if (!url) {
        logger.warn(
            "[redis] REDIS_URL not defined — rate limiting will use in-memory store (not distributed)."

        );
        return null;
    }

    redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
    });

    redisClient.on("error", (err) => {
        logger.error("[redis] Connection error", { error: err.message });
    });

    redisClient.on("connect", () => {
        logger.info("[redis] Connected.");
    });

    return redisClient;
}
