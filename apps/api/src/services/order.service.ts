
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { CartModel } from "../models/cart.model.js";
import type { CartItem } from "../models/cart.model.js";

import { ProductModel } from "../models/product.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { OrderModel, PAYMENT_METHODS } from "../models/order.model.js";

import type {
  OrderAddress,
  OrderLineItem,
  SellerOrder,
  OrderStatus,
  PaymentMethod,
} from "../models/order.model.js";

import { AppError } from "../middleware/app-error.js";

// Validate checkout information.
const createOrderSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS),

  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(7).max(20),
    addressLine1: z.string().trim().min(5).max(200),
    addressLine2: z.string().trim().max(200).optional(),
    landmark: z.string().trim().max(120).optional(),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().min(3).max(12),
    country: z.string().trim().min(2).max(80).default("India"),
  }),
});

// Generate a unique order number.
function generateOrderNumber(): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString("hex").toUpperCase();

  return `ORD-${timestamp}-${random}`;
}

// Create a new order from the customer's cart.
export async function createOrder(
  userId: string,
  input: unknown,
) {
  const data = createOrderSchema.parse(input);

  const shippingAddress: OrderAddress = data.shippingAddress;
  const paymentMethod: PaymentMethod = data.paymentMethod;

  const session = await mongoose.startSession();

  try {
    const result = await session.withTransaction(async () => {
      // 1. Find the customer's shopping cart.
      const cart = await CartModel.findOne({
        user: userId,
      }).session(session);

      if (!cart || cart.items.length === 0) {
        throw new AppError(
          400,
          "CART_EMPTY",
          "Your shopping cart is empty.",
        );
      }

      const cartItems: CartItem[] = cart.items as CartItem[];

      // 2. Retrieve all products in the cart.
      const productIds = cartItems.map(
        (item: CartItem) => item.product,
      );

      const products = await ProductModel.find({
        _id: { $in: productIds },
      }).session(session);

      if (products.length !== cartItems.length) {
        throw new AppError(
          409,
          "PRODUCT_UNAVAILABLE",
          "One or more products in your cart are unavailable.",
        );
      }

      const productMap = new Map(
        products.map((product) => [
          product._id.toString(),
          product,
        ]),
      );

      // 3. Find all approved vendors for these products.
      const vendorIdStrings = [
        ...new Set(
          products.map((product) => product.vendor.toString()),
        ),
      ];

      const vendorIds = vendorIdStrings.map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      const vendors = await VendorModel.find({
        _id: { $in: vendorIds },
        status: "APPROVED",
      })
        .select("_id storeName storeSlug")
        .session(session)
        .lean();

      if (vendors.length !== vendorIdStrings.length) {
        throw new AppError(
          409,
          "VENDOR_UNAVAILABLE",
          "One or more product sellers are unavailable.",
        );
      }

      const vendorMap = new Map(
        vendors.map((vendor) => [
          vendor._id.toString(),
          vendor,
        ]),
      );

      // 4. Group products by vendor.
      const sellerOrderMap = new Map<string, SellerOrder>();

      let subtotalPaise = 0;

      for (const cartItem of cartItems) {
        const productId = cartItem.product.toString();

        const product = productMap.get(productId);

        if (!product || product.status !== "ACTIVE") {
          throw new AppError(
            409,
            "PRODUCT_UNAVAILABLE",
            "A product in your cart is no longer available.",
          );
        }

        const vendorId = product.vendor.toString();
        const vendor = vendorMap.get(vendorId);

        if (!vendor) {
          throw new AppError(
            409,
            "VENDOR_UNAVAILABLE",
            "The seller of a product is no longer approved.",
          );
        }

        if (
          product.inventoryQuantity < cartItem.quantity
        ) {
          throw new AppError(
            409,
            "INSUFFICIENT_STOCK",
            `${product.name} has only ${product.inventoryQuantity} units available.`,
          );
        }

        const lineTotalPaise =
          product.pricePaise * cartItem.quantity;

        if (!Number.isSafeInteger(lineTotalPaise)) {
          throw new AppError(
            400,
            "INVALID_ORDER_AMOUNT",
            "The product order amount is too large.",
          );
        }

        const lineItem: OrderLineItem = {
          productId: product._id,
          vendorId: product.vendor,
          productName: product.name,
          productSlug: product.slug,
          sku: product.sku,
          imageUrl: product.images[0]?.url,
          quantity: cartItem.quantity,
          unitPricePaise: product.pricePaise,
          lineTotalPaise,
        };

        let sellerOrder = sellerOrderMap.get(vendorId);

        if (!sellerOrder) {
          sellerOrder = {
            vendorId: product.vendor,
            storeName: vendor.storeName,
            storeSlug: vendor.storeSlug,
            fulfillmentStatus: "PENDING",
            items: [],
            subtotalPaise: 0,
          };

          sellerOrderMap.set(vendorId, sellerOrder);
        }

        sellerOrder.items.push(lineItem);
        sellerOrder.subtotalPaise += lineTotalPaise;

        subtotalPaise += lineTotalPaise;
      }

      // 5. Calculate the final order amount.
      const shippingFeePaise = 0;
      const discountPaise = 0;

      const totalPaise =
        subtotalPaise + shippingFeePaise - discountPaise;

      if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0) {
        throw new AppError(
          400,
          "INVALID_ORDER_AMOUNT",
          "The calculated order amount is invalid.",
        );
      }

      // 6. Reserve stock using atomic updates.
      // All updates are part of the same MongoDB transaction.
      for (const cartItem of cartItems) {
        const stockUpdate = await ProductModel.updateOne(
          {
            _id: cartItem.product,
            status: "ACTIVE",
            inventoryQuantity: {
              $gte: cartItem.quantity,
            },
          },
          {
            $inc: {
              inventoryQuantity: -cartItem.quantity,
            },
          },
          { session },
        );

        if (stockUpdate.modifiedCount !== 1) {
          throw new AppError(
            409,
            "INSUFFICIENT_STOCK",
            "Product stock changed during checkout. Please review your cart.",
          );
        }
      }

      // 7. Set order and payment status.
      const orderStatus: OrderStatus =
        paymentMethod === "CASH_ON_DELIVERY"
          ? "PLACED"
          : "PENDING_PAYMENT";

      // 8. Create the order.
      const orderNumber = generateOrderNumber();

      const [order] = await OrderModel.create(
        [
          {
            customer: new mongoose.Types.ObjectId(userId),
            orderNumber,
            status: orderStatus,

            payment: {
              method: paymentMethod,
              status: "PENDING",
              provider:
                paymentMethod === "RAZORPAY"
                  ? "RAZORPAY"
                  : undefined,
            },

            shippingAddress,
            sellerOrders: Array.from(
              sellerOrderMap.values(),
            ),

            subtotalPaise,
            shippingFeePaise,
            discountPaise,
            totalPaise,
            currency: "INR",
          },
        ],
        { session },
      );

      // 9. Clear the cart only after order creation succeeds.
      await CartModel.updateOne(
        {
          _id: cart._id,
          user: userId,
        },
        {
          $set: {
            items: [],
          },
        },
        { session },
      );

      return order.toObject();
    });

    if (!result) {
      throw new AppError(
        500,
        "ORDER_CREATION_FAILED",
        "The order could not be created.",
      );
    }

    return result;
  } finally {
    await session.endSession();
  }
}

// Retrieve the customer's order history.
export async function getCustomerOrders(
  userId: string,
  page = 1,
  limit = 20,
) {
  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : 1;

  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.floor(limit)))
    : 20;

  const filter = { customer: userId };

  const [items, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    OrderModel.countDocuments(filter),
  ]);

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

// Retrieve one order belonging to the logged-in customer.
export async function getCustomerOrderById(
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

  const order = await OrderModel.findOne({
    _id: orderId,
    customer: userId,
  }).lean();

  if (!order) {
    throw new AppError(
      404,
      "ORDER_NOT_FOUND",
      "Order not found.",
    );
  }

  return order;
}
