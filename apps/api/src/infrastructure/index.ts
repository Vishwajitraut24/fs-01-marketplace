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
  isRedisReady,
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

let elasticsearchConnected = false;

// Prevent repeated initialization in serverless instances.
let initializationPromise: Promise<void> | null = null;

export async function connectInfrastructure(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await Promise.all([
        isMongoReady()
          ? Promise.resolve()
          : connectMongo(),

        isRedisReady()
          ? Promise.resolve()
          : connectRedis(),
      ]);

      try {
        await connectElasticsearch();

        elasticsearchConnected = true;

        await ensureProductSearchIndex();

        await syncAllApprovedVendorProducts();

        logger.info(
          "Elasticsearch connected and product index is ready",
        );
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
    })();
  }

  try {
    await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    throw error;
  }
}

export async function disconnectInfrastructure(): Promise<void> {
  const disconnectTasks: Promise<void>[] = [
    disconnectMongo(),
    disconnectRedis(),
  ];

  if (elasticsearchConnected) {
    disconnectTasks.push(disconnectElasticsearch());
    elasticsearchConnected = false;
  }

  const results = await Promise.allSettled(disconnectTasks);

  initializationPromise = null;

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
    redis: isRedisReady() ? "up" : "down",
    elasticsearch: "down",
  };

  try {
    await elasticsearch.ping();
    status.elasticsearch = "up";
  } catch {
    status.elasticsearch = "down";
  }

  return status;
}