
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import mongoose from "mongoose";
import { z } from "zod";

import { env } from "../config/env.js";
import { OrderModel } from "../models/order.model.js";

import {
  RazorpayWebhookEventModel,
  RAZORPAY_WEBHOOK_EVENTS,
} from "../models/razorpay-webhook-event.model.js";

import { AppError } from "../middleware/app-error.js";

// Validate Razorpay payment information.
const paymentEntitySchema = z.object({
  id: z.string().optional(),
  order_id: z.string().nullable().optional(),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  captured: z.boolean().optional(),
}).passthrough();

// Validate Razorpay order information.
const orderEntitySchema = z.object({
  id: z.string(),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
}).passthrough();

// Validate the Razorpay webhook envelope.
const webhookPayloadSchema = z.object({
  event: z.string().min(1),
  payload: z.object({
    payment: z.object({
      entity: paymentEntitySchema,
    }).optional(),

    order: z.object({
      entity: orderEntitySchema,
    }).optional(),
  }).passthrough(),
}).passthrough();

type SupportedWebhookEvent =
  (typeof RAZORPAY_WEBHOOK_EVENTS)[number];

// Check MongoDB duplicate-key errors.
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

// Verify the signature against the original raw request body.
function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    env.RAZORPAY_WEBHOOK_SECRET,
  )
    .update(rawBody)
    .digest();

  const receivedSignature = Buffer.from(
    signature,
    "hex",
  );

  return (
    expectedSignature.length === receivedSignature.length &&
    timingSafeEqual(expectedSignature, receivedSignature)
  );
}

// Process an authenticated Razorpay webhook.
export async function processRazorpayWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  eventId: string | undefined,
) {
  // 1. Validate the raw request body.
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_BODY",
      "Webhook request body is missing or invalid.",
    );
  }

  // 2. Validate signature header.
  if (!signature) {
    throw new AppError(
      400,
      "MISSING_WEBHOOK_SIGNATURE",
      "Razorpay webhook signature is missing.",
    );
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_SIGNATURE",
      "Razorpay webhook signature verification failed.",
    );
  }

  // 3. Validate Razorpay event ID.
  const parsedEventId = z.string().min(1).max(200).safeParse(eventId);

  if (!parsedEventId.success) {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_EVENT_ID",
      "Razorpay webhook event ID is missing or invalid.",
    );
  }

  const uniqueEventId = parsedEventId.data;

  // 4. Parse JSON only after successful signature verification.
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_JSON",
      "Webhook body contains invalid JSON.",
    );
  }

  const parsedPayload = webhookPayloadSchema.safeParse(parsedBody);

  if (!parsedPayload.success) {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_PAYLOAD",
      "Razorpay webhook payload is invalid.",
    );
  }

  const webhook = parsedPayload.data;

  // 5. Ignore valid but unsupported event types.
  if (
    !RAZORPAY_WEBHOOK_EVENTS.includes(
      webhook.event as SupportedWebhookEvent,
    )
  ) {
    return {
      received: true,
      ignored: true,
      reason: "UNSUPPORTED_EVENT",
    };
  }

  const eventType = webhook.event as SupportedWebhookEvent;

  const payment = webhook.payload.payment?.entity;
  const gatewayOrder = webhook.payload.order?.entity;

  const razorpayOrderId =
    payment?.order_id || gatewayOrder?.id;

  const razorpayPaymentId = payment?.id;

  // 6. Start a MongoDB transaction.
  const session = await mongoose.startSession();

  try {
    try {
      const result = await session.withTransaction(async () => {
        // Store event receipt in the same transaction as order updates.
        // The unique eventId index prevents duplicate processing.
        const [eventRecord] = await RazorpayWebhookEventModel.create(
          [
            {
              eventId: uniqueEventId,
              eventType,
              razorpayOrderId,
              razorpayPaymentId,
              processingStatus: "RECEIVED",
            },
          ],
          { session },
        );

        // Authorization is not proof of captured payment.
        if (eventType === "payment.authorized") {
          eventRecord.processingStatus = "IGNORED";
          eventRecord.failureReason =
            "Payment authorization does not confirm capture.";

          await eventRecord.save({ session });

          return {
            received: true,
            processed: false,
            reason: "PAYMENT_NOT_CAPTURED",
          };
        }

        // A payment event without an associated gateway order
        // cannot be matched to a marketplace order.
        if (!razorpayOrderId) {
          eventRecord.processingStatus = "IGNORED";
          eventRecord.failureReason =
            "No Razorpay order ID was present in the event.";

          await eventRecord.save({ session });

          return {
            received: true,
            processed: false,
            reason: "ORDER_ID_MISSING",
          };
        }

        // Find the marketplace order associated with this gateway order.
        const order = await OrderModel.findOne({
          "payment.providerOrderId": razorpayOrderId,
          "payment.method": "RAZORPAY",
        }).session(session);

        if (!order) {
          eventRecord.processingStatus = "IGNORED";
          eventRecord.failureReason =
            "No matching marketplace order was found.";

          await eventRecord.save({ session });

          return {
            received: true,
            processed: false,
            reason: "MARKETPLACE_ORDER_NOT_FOUND",
          };
        }

        eventRecord.order = order._id;

        // Validate gateway amount and currency when available.
        const eventAmount =
          payment?.amount ?? gatewayOrder?.amount;

        const eventCurrency =
          payment?.currency ?? gatewayOrder?.currency;

        if (
          eventAmount === undefined ||
          !Number.isSafeInteger(eventAmount) ||
          eventAmount !== order.totalPaise ||
          eventCurrency !== order.currency
        ) {
          throw new AppError(
            400,
            "WEBHOOK_PAYMENT_MISMATCH",
            "Webhook amount or currency does not match the marketplace order.",
          );
        }

        // PAYMENT FAILED
        if (eventType === "payment.failed") {
          if (order.payment.status !== "PAID") {
            order.payment.status = "FAILED";
            await order.save({ session });
          }

          eventRecord.processingStatus = "PROCESSED";
          eventRecord.processedAt = new Date();

          await eventRecord.save({ session });

          return {
            received: true,
            processed: true,
            paymentStatus: order.payment.status,
            orderNumber: order.orderNumber,
          };
        }

        // PAYMENT CAPTURED OR ORDER PAID
        if (
          eventType === "payment.captured" ||
          eventType === "order.paid"
        ) {
          const isCaptured =
            payment?.status === "captured" ||
            payment?.captured === true ||
            gatewayOrder?.status === "paid";

          if (!isCaptured) {
            throw new AppError(
              409,
              "PAYMENT_NOT_CAPTURED",
              "Webhook does not confirm a captured payment.",
            );
          }

          // Never downgrade or overwrite an already-paid order.
          if (order.payment.status !== "PAID") {
            if (order.status !== "PENDING_PAYMENT") {
              throw new AppError(
                409,
                "INVALID_ORDER_STATUS",
                "The marketplace order is no longer awaiting payment.",
              );
            }

            order.payment.status = "PAID";
            order.payment.provider = "RAZORPAY";

            if (razorpayPaymentId) {
              order.payment.providerPaymentId =
                razorpayPaymentId;
            }

            order.payment.paidAt = new Date();
            order.status = "PLACED";

            await order.save({ session });
          }

          eventRecord.processingStatus = "PROCESSED";
          eventRecord.processedAt = new Date();

          await eventRecord.save({ session });

          return {
            received: true,
            processed: true,
            paymentStatus: order.payment.status,
            orderStatus: order.status,
            orderNumber: order.orderNumber,
          };
        }

        // Defensive fallback.
        eventRecord.processingStatus = "IGNORED";
        await eventRecord.save({ session });

        return {
          received: true,
          processed: false,
          reason: "EVENT_NOT_HANDLED",
        };
      });

      return result;
    } catch (error) {
      // A repeated event is already being or has been processed.
      if (isDuplicateKeyError(error)) {
        return {
          received: true,
          duplicate: true,
          message: "Webhook event was already received.",
        };
      }

      throw error;
    }
  } finally {
    await session.endSession();
  }
}
