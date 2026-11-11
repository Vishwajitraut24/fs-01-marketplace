import mongoose from "mongoose";

import { OrderModel } from "../models/order.model.js";
import { ProductModel } from "../models/product.model.js";

import { syncProductToSearch } from "./product-search.service.js";
import { logger } from "../infrastructure/logger.js";

const PAYMENT_EXPIRY_MINUTES = 30;
const EXPIRY_BATCH_SIZE = 50;

const EXPIRABLE_PAYMENT_STATUSES = [
  "PENDING",
  "FAILED",
  "AUTHORIZED",
] as const;

// Expire unpaid orders that never reached the Razorpay gateway.
export async function expireUnsubmittedRazorpayOrders() {
  const cutoff = new Date(
    Date.now() - PAYMENT_EXPIRY_MINUTES * 60 * 1000,
  );

  const candidates = await OrderModel.find({
    status: "PENDING_PAYMENT",
    "payment.method": "RAZORPAY",
    "payment.status": {
      $in: EXPIRABLE_PAYMENT_STATUSES,
    },
    "payment.providerOrderId": {
      $exists: false,
    },
    createdAt: {
      $lte: cutoff,
    },
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .limit(EXPIRY_BATCH_SIZE)
    .lean();

  let expiredCount = 0;

  for (const candidate of candidates) {
    const session = await mongoose.startSession();

    try {
      const restoredProductIds = await session.withTransaction(
        async () => {
          const order = await OrderModel.findOne({
            _id: candidate._id,
            status: "PENDING_PAYMENT",
            "payment.method": "RAZORPAY",
            "payment.status": {
              $in: EXPIRABLE_PAYMENT_STATUSES,
            },
            "payment.providerOrderId": {
              $exists: false,
            },
            createdAt: {
              $lte: cutoff,
            },
          }).session(session);

          // Another process may already have handled this order.
          if (!order) {
            return [];
          }

          // Aggregate quantities by product to avoid duplicate updates.
          const quantities = new Map<
            string,
            {
              productId: mongoose.Types.ObjectId;
              quantity: number;
            }
          >();

          for (const sellerOrder of order.sellerOrders) {
            for (const item of sellerOrder.items) {
              const productId = item.productId.toString();
              const existing = quantities.get(productId);

              if (existing) {
                existing.quantity += item.quantity;
              } else {
                quantities.set(productId, {
                  productId: item.productId,
                  quantity: item.quantity,
                });
              }
            }
          }

          // Restore inventory inside the same MongoDB transaction.
          for (const item of quantities.values()) {
            const update = await ProductModel.updateOne(
              {
                _id: item.productId,
              },
              {
                $inc: {
                  inventoryQuantity: item.quantity,
                },
              },
              {
                session,
              },
            );

            if (update.modifiedCount !== 1) {
              throw new Error(
                `Could not restore inventory for product ${item.productId}`,
              );
            }
          }

          // Cancel the order only after inventory restoration succeeds.
          order.status = "CANCELLED";
          order.payment.status = "FAILED";

          for (const sellerOrder of order.sellerOrders) {
            sellerOrder.fulfillmentStatus = "CANCELLED";
          }

          await order.save({ session });

          return Array.from(quantities.keys());
        },
      );

      if (restoredProductIds?.length) {
        await Promise.all(
          restoredProductIds.map((productId) =>
            syncProductToSearch(productId),
          ),
        );

        expiredCount++;

        logger.info(
          {
            orderId: candidate._id.toString(),
            restoredProducts: restoredProductIds.length,
          },
          "Expired unpaid order and restored inventory",
        );
      }
    } catch (error) {
      logger.error(
        {
          orderId: candidate._id.toString(),
          error,
        },
        "Unable to expire unpaid order",
      );
    } finally {
      await session.endSession();
    }
  }

  return {
    scanned: candidates.length,
    expired: expiredCount,
  };
}