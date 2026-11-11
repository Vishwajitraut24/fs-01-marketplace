import { app } from "./app.js";
import { env } from "./config/env.js";

import {
  disconnectInfrastructure,
  connectInfrastructure,
} from "./infrastructure/index.js";

import { logger } from "./infrastructure/logger.js";

import {
  expireUnsubmittedRazorpayOrders,
} from "./services/order-expiry.service.js";

const ORDER_EXPIRY_INTERVAL_MS = 5 * 60 * 1000;

async function bootstrap(): Promise<void> {
  await connectInfrastructure();

  // Prevent overlapping cleanup executions.
  let expiryPromise: Promise<void> | null = null;

  function runOrderExpiry(): Promise<void> {
    if (expiryPromise) {
      return expiryPromise;
    }

    expiryPromise = expireUnsubmittedRazorpayOrders()
      .then((result) => {
        if (result.expired > 0) {
          logger.info(
            result,
            "Expired unpaid orders and restored inventory",
          );
        }
      })
      .catch((error: unknown) => {
        logger.error(
          { error },
          "Automatic order expiry failed",
        );
      })
      .finally(() => {
        expiryPromise = null;
      });

    return expiryPromise;
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT },
      "FS-01 API is listening",
    );
  });

  // Run once at startup.
  void runOrderExpiry();

  // Repeat every five minutes.
  const orderExpiryTimer = setInterval(() => {
    void runOrderExpiry();
  }, ORDER_EXPIRY_INTERVAL_MS);

  let isShuttingDown = false;

  const shutdown = (signal: string): void => {
    if (isShuttingDown) return;

    isShuttingDown = true;

    logger.info(
      { signal },
      "Graceful shutdown started",
    );

    // Stop scheduling new cleanup tasks.
    clearInterval(orderExpiryTimer);

    server.close(() => {
      void (async () => {
        // Allow any current cleanup to finish.
        if (expiryPromise) {
          await expiryPromise;
        }

        await disconnectInfrastructure();

        process.exit(0);
      })();
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
  logger.fatal(
    { error },
    "API startup failed",
  );

  void disconnectInfrastructure().finally(() => {
    process.exit(1);
  });
});