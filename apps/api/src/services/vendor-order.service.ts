
import mongoose from "mongoose";
import { z } from "zod";

import { OrderModel } from "../models/order.model.js";
import { VendorModel } from "../models/vendor.model.js";

import { FULFILLMENT_STATUSES } from "../models/order.model.js";

import type {
  FulfillmentStatus,
  OrderStatus,
  SellerOrder,
} from "../models/order.model.js";

import { AppError } from "../middleware/app-error.js";

// Validate fulfillment status updates.
const fulfillmentStatusSchema = z.enum(FULFILLMENT_STATUSES);

// Find the approved vendor belonging to the logged-in user.
async function getApprovedVendor(userId: string) {
  const vendor = await VendorModel.findOne({
    owner: userId,
    status: "APPROVED",
  }).select("_id storeName storeSlug");

  if (!vendor) {
    throw new AppError(
      403,
      "VENDOR_NOT_APPROVED",
      "Only approved vendors can manage orders.",
    );
  }

  return vendor;
}

// Only COD orders or successfully paid online orders
// can enter vendor fulfillment.
function getFulfillableOrderFilter() {
  return {
    $or: [
      {
        "payment.method": "CASH_ON_DELIVERY",
      },
      {
        "payment.status": "PAID",
      },
    ],
  };
}

// Calculate the overall order status from all seller statuses.
function calculateOrderStatus(
  statuses: readonly FulfillmentStatus[],
): OrderStatus {
  if (statuses.length === 0) {
    return "PLACED";
  }

  if (statuses.every((status) => status === "CANCELLED")) {
    return "CANCELLED";
  }

  if (statuses.every(
    (status) =>
      status === "DELIVERED" || status === "CANCELLED",
  )) {
    return "DELIVERED";
  }

  const shippedOrDelivered = statuses.filter(
    (status) =>
      status === "SHIPPED" || status === "DELIVERED",
  ).length;

  if (shippedOrDelivered > 0) {
    if (shippedOrDelivered === statuses.length) {
      return "SHIPPED";
    }

    return "PARTIALLY_SHIPPED";
  }

  if (
    statuses.some(
      (status) =>
        status === "PROCESSING" ||
        status === "CONFIRMED",
    )
  ) {
    return "PROCESSING";
  }

  return "PLACED";
}

// Allowed vendor fulfillment transitions.
// Explicit readonly arrays prevent TypeScript includes() errors.
const allowedTransitions: Record<
  FulfillmentStatus,
  readonly FulfillmentStatus[]
> = {
  PENDING: ["CONFIRMED"],
  CONFIRMED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// GET ORDERS BELONGING TO THE LOGGED-IN VENDOR.
export async function getVendorOrders(
  userId: string,
  page = 1,
  limit = 20,
) {
  const vendor = await getApprovedVendor(userId);

  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : 1;

  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.floor(limit)))
    : 20;

  const filter = {
    "sellerOrders.vendorId": vendor._id,
    ...getFulfillableOrderFilter(),
  };

  const [orders, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    OrderModel.countDocuments(filter),
  ]);

  // Return only this vendor's seller-order section.
  // Other vendors' seller orders are not exposed.
  const items = orders
    .map((order) => {
      const sellerOrder = order.sellerOrders.find(
        (item: SellerOrder) =>
          item.vendorId.toString() === vendor._id.toString(),
      );

      if (!sellerOrder) {
        return null;
      }

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        payment: {
          method: order.payment.method,
          status: order.payment.status,
        },
        shippingAddress: order.shippingAddress,
        sellerOrder,
        createdAt: order.createdAt,
      };
    })
    .filter((item) => item !== null);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

// GET ONE ORDER BELONGING TO THE LOGGED-IN VENDOR.
export async function getVendorOrderById(
  userId: string,
  orderId: string,
) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError(
      400,
      "INVALID_ORDER_ID",
      "The provided order ID is invalid.",
    );
  }

  const vendor = await getApprovedVendor(userId);

  const order = await OrderModel.findOne({
    _id: orderId,
    "sellerOrders.vendorId": vendor._id,
    ...getFulfillableOrderFilter(),
  }).lean();

  if (!order) {
    throw new AppError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found in your vendor account.",
    );
  }

  const sellerOrder = order.sellerOrders.find(
    (item: SellerOrder) =>
      item.vendorId.toString() === vendor._id.toString(),
  );

  if (!sellerOrder) {
    throw new AppError(
      404,
      "VENDOR_ORDER_NOT_FOUND",
      "Your seller order was not found.",
    );
  }

  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    payment: {
      method: order.payment.method,
      status: order.payment.status,
    },
    shippingAddress: order.shippingAddress,
    sellerOrder,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

// UPDATE THE VENDOR'S FULFILLMENT STATUS.
export async function updateVendorOrderStatus(
  userId: string,
  orderId: string,
  input: unknown,
) {
  if (!mongoose.isValidObjectId(orderId)) {
    throw new AppError(
      400,
      "INVALID_ORDER_ID",
      "The provided order ID is invalid.",
    );
  }

  const parsedInput = z.object({
    status: fulfillmentStatusSchema,
  }).parse(input);

  const nextStatus: FulfillmentStatus = parsedInput.status;

  const vendor = await getApprovedVendor(userId);

  const order = await OrderModel.findOne({
    _id: orderId,
    "sellerOrders.vendorId": vendor._id,
    ...getFulfillableOrderFilter(),
  });

  if (!order) {
    throw new AppError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found in your vendor account.",
    );
  }

  const sellerOrder = order.sellerOrders.find(
    (item: SellerOrder) =>
      item.vendorId.toString() === vendor._id.toString(),
  );

  if (!sellerOrder) {
    throw new AppError(
      404,
      "VENDOR_ORDER_NOT_FOUND",
      "Your seller order was not found.",
    );
  }

  const currentStatus: FulfillmentStatus =
    sellerOrder.fulfillmentStatus;

  // Explicitly type the permitted next statuses.
  const permittedStatuses: readonly FulfillmentStatus[] =
    allowedTransitions[currentStatus] ?? [];

  if (!permittedStatuses.includes(nextStatus)) {
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      `Cannot change fulfillment status from ${currentStatus} to ${nextStatus}.`,
    );
  }

  // Update only this vendor's seller order.
  sellerOrder.fulfillmentStatus = nextStatus;

  // Recalculate the overall order status.
  const allSellerStatuses: FulfillmentStatus[] =
    order.sellerOrders.map(
      (item: SellerOrder) => item.fulfillmentStatus,
    );

  order.status = calculateOrderStatus(allSellerStatuses);

  await order.save();

  return {
    orderId: order._id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    sellerOrder: {
      vendorId: sellerOrder.vendorId,
      storeName: sellerOrder.storeName,
      fulfillmentStatus: sellerOrder.fulfillmentStatus,
      subtotalPaise: sellerOrder.subtotalPaise,
      items: sellerOrder.items,
    },
  };
}
