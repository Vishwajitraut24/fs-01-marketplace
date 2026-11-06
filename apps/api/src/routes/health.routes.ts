
import { Router } from "express";
import { env } from "../config/env.js";
import { getDependencyHealth } from "../infrastructure/index.js";

export const healthRouter = Router();

healthRouter.get("/live", (_request, response) => {
  response.status(200).json({
    success: true,
    data: { status: "alive" },
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (_request, response) => {
  const checks = await getDependencyHealth();

  // MongoDB and Redis are required in every environment.
  // Elasticsearch is additionally required in production.
  const ready =
    checks.mongodb === "up" &&
    checks.redis === "up" &&
    (env.NODE_ENV !== "production" || checks.elasticsearch === "up");

  response.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? "ready" : "not_ready",
      checks,
    },
    timestamp: new Date().toISOString(),
  });
});
