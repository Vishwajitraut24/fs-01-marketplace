import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8_000,
    maxPoolSize: 20,
    minPoolSize: 2,
    autoIndex: env.NODE_ENV !== "production"
  });
  logger.info("MongoDB connected");
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1;
}
