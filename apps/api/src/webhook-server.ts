
import express from "express";

import razorpayWebhookRouter from "./routes/razorpay-webhook.routes.js";
import { AppError } from "./middleware/app-error.js";

const app = express();

app.disable("x-powered-by");

// Only expose the Razorpay webhook endpoint.
app.use(
  "/api/v1/webhooks/razorpay",
  razorpayWebhookRouter,
);

// Simple local health check.
app.get("/health", (_request, response) => {
  response.status(200).json({
    success: true,
    service: "razorpay-webhook-receiver",
  });
});

// Centralized error handling.
app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof AppError) {
      response.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      });

      return;
    }

    console.error("Webhook receiver error:", error);

    response.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  },
);

const PORT = 4001;

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Razorpay webhook receiver listening on port ${PORT}`,
  );
});
