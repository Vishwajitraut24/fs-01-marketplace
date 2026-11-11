
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

import {
  ensureProductSearchIndex,
  syncAllApprovedVendorProducts,
} from "../services/product-search.service.js";

// Track whether Elasticsearch successfully connected.
let elasticsearchConnected = false;

export async function connectInfrastructure(): Promise<void> {
  // MongoDB and Redis are required.
  await Promise.all([
    connectMongo(),
    connectRedis(),
  ]);

  // Attempt Elasticsearch connection in every environment.
  try {
  await connectElasticsearch();

  elasticsearchConnected = true;

  await ensureProductSearchIndex();

  await syncAllApprovedVendorProducts();

  logger.info("Elasticsearch connected and product index is ready");
} catch (error) {
  if (env.NODE_ENV === "production") {
    throw error;
  }

  logger.warn(
    { error },
    "Elasticsearch unavailable in development",
  );
}

  logger.info("Infrastructure dependencies initialized");
}

export async function disconnectInfrastructure(): Promise<void> {
  const disconnectTasks = [
    disconnectMongo(),
    disconnectRedis(),
  ];

  // Close Elasticsearch only if it connected successfully.
  if (elasticsearchConnected) {
    disconnectTasks.push(disconnectElasticsearch());
    elasticsearchConnected = false;
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

  // Check Elasticsearch in both development and production.
  try {
    await elasticsearch.ping();
    status.elasticsearch = "up";
  } catch {
    status.elasticsearch = "down";
  }

  return status;
}