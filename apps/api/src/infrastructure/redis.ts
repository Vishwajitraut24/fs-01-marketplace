import { createClient } from "redis";
import { Redis as UpstashRedis } from "@upstash/redis";

import { env } from "../config/env.js";
import { logger } from "./logger.js";

// Existing local Redis client.
export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) =>
      Math.min(retries * 250, 3_000),
  },
});

// Upstash REST client for Vercel.
export const upstashRedis =
  env.REDIS_PROVIDER === "upstash"
    ? new UpstashRedis({
        url: env.UPSTASH_REDIS_REST_URL!,
        token: env.UPSTASH_REDIS_REST_TOKEN!,
      })
    : null;

let upstashReady = false;

redis.on("error", (error) =>
  logger.error({ error }, "Redis client error"),
);

redis.on("ready", () =>
  logger.info("Local Redis connected"),
);

export function isRedisReady(): boolean {
  return env.REDIS_PROVIDER === "upstash"
    ? upstashReady
    : redis.isReady;
}

export async function connectRedis(): Promise<void> {
  if (env.REDIS_PROVIDER === "upstash") {
    if (!upstashRedis) {
      throw new Error("Upstash Redis is not configured.");
    }

    await upstashRedis.ping();

    upstashReady = true;

    logger.info("Upstash Redis connected");

    return;
  }

  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (env.REDIS_PROVIDER === "upstash") {
    upstashReady = false;
    return;
  }

  if (redis.isOpen) {
    await redis.close();
  }
}