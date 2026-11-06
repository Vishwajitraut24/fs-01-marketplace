import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

// Load the single repository-level .env file regardless of which workspace
// npm uses as the current working directory.
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const envPath = resolve(repositoryRoot, ".env");
if (existsSync(envPath)) dotenv.config({ path: envPath });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MONGODB_URI: z.string().min(1).default("mongodb://localhost:27017/fs01_marketplace?replicaSet=rs0"),
  REDIS_URL: z.string().min(1).default("redis://:dev_redis_password_change_me@localhost:6379"),
  ELASTICSEARCH_NODE: z.string().url().default("http://localhost:9200"),
  JWT_ACCESS_SECRET: z.string().min(32),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(32),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;