import rateLimit, { Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "./redisClient";

/**
 * Creates a rate limiter that uses Redis as a store when available
 * (supporting horizontal scaling with a shared counter across instances),
 * with automatic fallback to in-memory store.
 */
export function createRateLimiter(options: Partial<Options> & { prefix?: string }) {
    const { prefix, ...rateLimitOptions } = options;
    const redis = getRedisClient();

    return rateLimit({
        standardHeaders: true,
        legacyHeaders: false,
        ...rateLimitOptions,
        ...(redis
            ? {
                  store: new RedisStore({
                      sendCommand: (...args: string[]) =>
                          redis.call(...(args as [string, ...string[]])) as Promise<any>,
                      prefix: prefix ?? "rl:",
                  }),
              }
            : {}),
    });
}
