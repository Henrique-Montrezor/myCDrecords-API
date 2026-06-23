import rateLimit, { Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisClient } from "./redisClient";

/**
 * Cria um rate limiter que usa o Redis como store quando disponível
 * (suportando escala horizontal com contador compartilhado entre instâncias),
 * com fallback automático para o store em memória.
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
