
import express, { Router } from "express";

import { processRazorpayWebhook } from "../services/razorpay-webhook.service.js";

import { AppError } from "../middleware/app-error.js";

const router = Router();

// Receive Razorpay's original raw JSON request body.
// This must run before the application's global JSON parser.
router.post(
  "/",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  async (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      throw new AppError(
        400,
        "INVALID_WEBHOOK_BODY",
        "Expected the original raw JSON request body.",
      );
    }

    const signature = request.get("x-razorpay-signature");
    const eventId = request.get("x-razorpay-event-id");

    const result = await processRazorpayWebhook(
      request.body,
      signature,
      eventId,
    );

    response.status(200).json({
      success: true,
      message: "Razorpay webhook received successfully.",
      data: result,
    });
  },
);

export default router;
