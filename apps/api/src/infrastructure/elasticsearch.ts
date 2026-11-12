import { Client } from "@elastic/elasticsearch";

import { env } from "../config/env.js";

export const elasticsearch = new Client({
  node: env.ELASTICSEARCH_NODE,

  ...(env.ELASTICSEARCH_API_KEY
    ? {
        auth: {
          apiKey: env.ELASTICSEARCH_API_KEY,
        },
      }
    : {}),

  requestTimeout: 10_000,
  maxRetries: 2,
});

export async function connectElasticsearch(): Promise<void> {
  await elasticsearch.ping();
}

export async function disconnectElasticsearch(): Promise<void> {
  await elasticsearch.close();
}