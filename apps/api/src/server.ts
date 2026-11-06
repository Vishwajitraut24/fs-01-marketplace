import { app } from "./app.js";
import { env } from "./config/env.js";
import { disconnectInfrastructure, connectInfrastructure } from "./infrastructure/index.js";
import { logger } from "./infrastructure/logger.js";

async function bootstrap(): Promise<void> {
  await connectInfrastructure();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "FS-01 API is listening");
  });

  let isShuttingDown = false;
  const shutdown = (signal: string): void => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");
    server.close(() => {
      void disconnectInfrastructure().finally(() => process.exit(0));
    });
    setTimeout(() => {
      logger.error("Graceful shutdown timed out");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ error }, "API startup failed");
  void disconnectInfrastructure().finally(() => process.exit(1));
});
