
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import {
  connectMongo,
  disconnectMongo,
  isMongoReady,
} from "./mongo.js";
import {
  connectRedis,
  disconnectRedis,
  redis,
} from "./redis.js";
import {
  connectElasticsearch,
  disconnectElasticsearch,
  elasticsearch,
} from "./elasticsearch.js";

export async function connectInfrastructure(): Promise<void> {
  // MongoDB and Redis are required for the marketplace.
  await Promise.all([connectMongo(), connectRedis()]);

  // Elasticsearch is required in production but optional locally.
  if (env.NODE_ENV === "production") {
    await connectElasticsearch();
  } else {
    logger.info("Elasticsearch connection skipped in development");
  }

  logger.info("Required infrastructure dependencies are ready");
}

export async function disconnectInfrastructure(): Promise<void> {
  const disconnectTasks = [disconnectMongo(), disconnectRedis()];

  if (env.NODE_ENV === "production") {
    disconnectTasks.push(disconnectElasticsearch());
  }

  const results = await Promise.allSettled(disconnectTasks);

  for (const result of results) {
    if (result.status === "rejected") {
      logger.error(
        { error: result.reason },
        "Error closing dependency",
      );
    }
  }
}

export async function getDependencyHealth(): Promise<
  Record<string, "up" | "down">
> {
  const status: Record<string, "up" | "down"> = {
    mongodb: isMongoReady() ? "up" : "down",
    redis: redis.isReady ? "up" : "down",
    elasticsearch: "down",
  };

  // Do not ping Elasticsearch during local development.
  if (env.NODE_ENV !== "production") {
    return status;
  }

  try {
    await elasticsearch.ping();
    status.elasticsearch = "up";
  } catch {
    status.elasticsearch = "down";
  }

  return status;
}
