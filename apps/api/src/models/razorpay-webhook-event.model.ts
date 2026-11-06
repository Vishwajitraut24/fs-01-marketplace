
import mongoose, { Schema } from "mongoose";

// Webhook processing statuses.
export const WEBHOOK_PROCESSING_STATUSES = [
  "RECEIVED",
  "PROCESSED",
  "IGNORED",
  "FAILED",
] as const;

export type WebhookProcessingStatus =
  (typeof WEBHOOK_PROCESSING_STATUSES)[number];

// Supported Razorpay event names.
export const RAZORPAY_WEBHOOK_EVENTS = [
  "payment.authorized",
  "payment.captured",
  "payment.failed",
  "order.paid",
] as const;

export type RazorpayWebhookEventType =
  (typeof RAZORPAY_WEBHOOK_EVENTS)[number];

// Webhook event structure.
export interface RazorpayWebhookEvent {
  eventId: string;
  eventType: RazorpayWebhookEventType;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  order?: mongoose.Types.ObjectId;
  processingStatus: WebhookProcessingStatus;
  receivedAt: Date;
  processedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// MongoDB webhook event schema.
const webhookEventSchema =
  new Schema<RazorpayWebhookEvent>(
    {
      eventId: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },

      eventType: {
        type: String,
        enum: RAZORPAY_WEBHOOK_EVENTS,
        required: true,
      },

      razorpayOrderId: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      razorpayPaymentId: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      order: {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },

      processingStatus: {
        type: String,
        enum: WEBHOOK_PROCESSING_STATUSES,
        default: "RECEIVED",
        required: true,
      },

      receivedAt: {
        type: Date,
        default: Date.now,
        required: true,
      },

      processedAt: {
        type: Date,
      },

      failureReason: {
        type: String,
        maxlength: 1000,
      },
    },
    {
      timestamps: true,
    },
  );

// Prevent duplicate webhook event records.
webhookEventSchema.index(
  { eventId: 1 },
  { unique: true },
);

// Helpful index for processing pending events.
webhookEventSchema.index({
  processingStatus: 1,
  createdAt: 1,
});

export const RazorpayWebhookEventModel =
  mongoose.models.RazorpayWebhookEvent ||
  mongoose.model<RazorpayWebhookEvent>(
    "RazorpayWebhookEvent",
    webhookEventSchema,
  );
