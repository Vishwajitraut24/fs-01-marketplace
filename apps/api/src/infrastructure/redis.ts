import { createClient } from "redis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export const redis = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 250, 3_000)
  }
});

redis.on("error", (error) => logger.error({ error }, "Redis client error"));
redis.on("ready", () => logger.info("Redis connected"));

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redis.isOpen) await redis.close();
}
