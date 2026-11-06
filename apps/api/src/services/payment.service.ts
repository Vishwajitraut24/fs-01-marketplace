
import { createHmac, timingSafeEqual } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { razorpay } from "../infrastructure/razorpay.js";
import { env } from "../config/env.js";
import { OrderModel } from "../models/order.model.js";
import { AppError } from "../middleware/app-error.js";

// Validate the local marketplace order ID.
const createPaymentOrderSchema = z.object({
  orderId: z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid order ID.",
  ),
});

// Validate payment verification information.
const verifyPaymentSchema = z.object({
  orderId: z.string().refine(
    (value) => mongoose.isValidObjectId(value),
    "Invalid order ID.",
  ),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

// CREATE RAZORPAY ORDER.
export async function createRazorpayOrder(
  userId: string,
  input: unknown,
) {
  const { orderId } = createPaymentOrderSchema.parse(input);

  // Find an order belonging to the logged-in customer.
  const order = await OrderModel.findOne({
    _id: orderId,
    customer: userId,
  });

  if (!order) {
    throw new AppError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found.",
    );
  }

  if (order.payment.method !== "RAZORPAY") {
    throw new AppError(
      400,
      "INVALID_PAYMENT_METHOD",
      "This order is not configured for Razorpay.",
    );
  }

  if (order.payment.status === "PAID") {
    throw new AppError(
      409,
      "ORDER_ALREADY_PAID",
      "This order has already been paid.",
    );
  }

  if (order.status !== "PENDING_PAYMENT") {
    throw new AppError(
      409,
      "INVALID_ORDER_STATUS",
      "This order is not awaiting payment.",
    );
  }

  // Return the existing gateway order if one was already created.
  // This makes ordinary client retries safer.
  if (order.payment.providerOrderId) {
    return {
      keyId: env.RAZORPAY_KEY_ID,
      razorpayOrderId: order.payment.providerOrderId,
      amount: order.totalPaise,
      currency: order.currency,
      receipt: order.orderNumber,
    };
  }

  // Create the payment order using the server-calculated total.
  const gatewayOrder = await razorpay.orders.create({
    amount: order.totalPaise,
    currency: "INR",
    receipt: order.orderNumber,
    notes: {
      marketplaceOrderId: order._id.toString(),
      orderNumber: order.orderNumber,
    },
  });

  if (
    gatewayOrder.amount !== order.totalPaise ||
    gatewayOrder.currency !== "INR"
  ) {
    throw new AppError(
      502,
      "RAZORPAY_ORDER_MISMATCH",
      "The payment gateway returned an unexpected order amount.",
    );
  }

  // Save the Razorpay order ID in our marketplace database.
  order.payment.provider = "RAZORPAY";
  order.payment.providerOrderId = gatewayOrder.id;

  await order.save();

  return {
    keyId: env.RAZORPAY_KEY_ID,
    razorpayOrderId: gatewayOrder.id,
    amount: gatewayOrder.amount,
    currency: gatewayOrder.currency,
    receipt: gatewayOrder.receipt,
  };
}

// VERIFY THE RAZORPAY PAYMENT.
export async function verifyRazorpayPayment(
  userId: string,
  input: unknown,
) {
  const data = verifyPaymentSchema.parse(input);

  // Find the customer's local marketplace order.
  const order = await OrderModel.findOne({
    _id: data.orderId,
    customer: userId,
  });

  if (!order) {
    throw new AppError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found.",
    );
  }

  if (order.payment.method !== "RAZORPAY") {
    throw new AppError(
      400,
      "INVALID_PAYMENT_METHOD",
      "This order does not use Razorpay.",
    );
  }

  // Ensure the gateway order belongs to this marketplace order.
  if (
    order.payment.providerOrderId !== data.razorpay_order_id
  ) {
    throw new AppError(
      400,
      "RAZORPAY_ORDER_MISMATCH",
      "The Razorpay order ID does not match.",
    );
  }

  // Verify the Razorpay Checkout signature using HMAC SHA256.
  const expectedSignature = createHmac(
    "sha256",
    env.RAZORPAY_KEY_SECRET,
  )
    .update(
      `${data.razorpay_order_id}|${data.razorpay_payment_id}`,
    )
    .digest("hex");

  const expectedBuffer = Buffer.from(
    expectedSignature,
    "hex",
  );

  const receivedBuffer = Buffer.from(
    data.razorpay_signature,
    "hex",
  );

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    throw new AppError(
      400,
      "INVALID_PAYMENT_SIGNATURE",
      "Razorpay payment signature verification failed.",
    );
  }

  // Retrieve payment information directly from Razorpay.
  // Never trust payment amount or status supplied by the frontend.
  let payment = await razorpay.payments.fetch(
    data.razorpay_payment_id,
  );

  // Verify that the payment belongs to the expected gateway order.
  if (payment.order_id !== data.razorpay_order_id) {
    throw new AppError(
      400,
      "PAYMENT_ORDER_MISMATCH",
      "The payment does not belong to this Razorpay order.",
    );
  }

  // Verify payment amount and currency.
  if (
    payment.amount !== order.totalPaise ||
    payment.currency !== "INR"
  ) {
    throw new AppError(
      400,
      "PAYMENT_AMOUNT_MISMATCH",
      "The payment amount or currency does not match the order.",
    );
  }

  // Capture an authorized payment if automatic capture
  // has not already completed.
  if (payment.status === "authorized") {
    payment = await razorpay.payments.capture(
      data.razorpay_payment_id,
      order.totalPaise,
      "INR",
    );
  }

  // Only captured payments can mark a marketplace order as paid.
  if (
    payment.status !== "captured" ||
    payment.captured !== true
  ) {
    throw new AppError(
      409,
      "PAYMENT_NOT_CAPTURED",
      "The Razorpay payment has not been captured successfully.",
    );
  }

  // Update the marketplace order atomically.
  const session = await mongoose.startSession();

  try {
    const updatedOrder = await session.withTransaction(
      async () => {
        const currentOrder = await OrderModel.findOne({
          _id: data.orderId,
          customer: userId,
        }).session(session);

        if (!currentOrder) {
          throw new AppError(
            404,
            "ORDER_NOT_FOUND",
            "Order not found.",
          );
        }

        // Make verification safe to retry with the same payment.
        if (currentOrder.payment.status === "PAID") {
          if (
            currentOrder.payment.providerPaymentId !==
            data.razorpay_payment_id
          ) {
            throw new AppError(
              409,
              "ORDER_ALREADY_PAID",
              "This order was paid using another payment.",
            );
          }

          return currentOrder.toObject();
        }

        if (
          currentOrder.payment.providerOrderId !==
          data.razorpay_order_id
        ) {
          throw new AppError(
            409,
            "RAZORPAY_ORDER_MISMATCH",
            "The stored Razorpay order ID has changed.",
          );
        }

        if (currentOrder.status !== "PENDING_PAYMENT") {
          throw new AppError(
            409,
            "INVALID_ORDER_STATUS",
            "This order is no longer awaiting payment.",
          );
        }

        currentOrder.payment.status = "PAID";
        currentOrder.payment.provider = "RAZORPAY";
        currentOrder.payment.providerPaymentId =
          data.razorpay_payment_id;
        currentOrder.payment.paidAt = new Date();

        currentOrder.status = "PLACED";

        await currentOrder.save({ session });

        return currentOrder.toObject();
      },
    );

    if (!updatedOrder) {
      throw new AppError(
        500,
        "PAYMENT_UPDATE_FAILED",
        "Payment was verified but the order update failed.",
      );
    }

    return {
      success: true,
      message: "Payment verified successfully.",
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      orderStatus: updatedOrder.status,
      paymentStatus: updatedOrder.payment.status,
      paymentId: updatedOrder.payment.providerPaymentId,
      totalPaise: updatedOrder.totalPaise,
      currency: updatedOrder.currency,
    };
  } finally {
    await session.endSession();
  }
}
