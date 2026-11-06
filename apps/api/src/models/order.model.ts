
import mongoose, { Schema } from "mongoose";

// Overall order statuses.
export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PLACED",
  "PROCESSING",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Payment statuses.
export const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[number];

// Vendor fulfillment statuses.
export const FULFILLMENT_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type FulfillmentStatus =
  (typeof FULFILLMENT_STATUSES)[number];

// Supported payment methods.
export const PAYMENT_METHODS = [
  "RAZORPAY",
  "CASH_ON_DELIVERY",
] as const;

export type PaymentMethod =
  (typeof PAYMENT_METHODS)[number];

// Shipping address saved as an order snapshot.
export interface OrderAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  landmark?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// Product information saved at purchase time.
export interface OrderLineItem {
  productId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  productName: string;
  productSlug: string;
  sku: string;
  imageUrl?: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

// Products grouped by their respective vendor.
export interface SellerOrder {
  vendorId: mongoose.Types.ObjectId;
  storeName: string;
  storeSlug: string;
  fulfillmentStatus: FulfillmentStatus;
  items: OrderLineItem[];
  subtotalPaise: number;
}

// Payment information.
export interface OrderPayment {
  method: PaymentMethod;
  status: PaymentStatus;
  provider?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  paidAt?: Date;
}

// Complete order structure.
export interface Order {
  customer: mongoose.Types.ObjectId;
  orderNumber: string;
  status: OrderStatus;
  payment: OrderPayment;
  shippingAddress: OrderAddress;
  sellerOrders: SellerOrder[];
  subtotalPaise: number;
  shippingFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  currency: "INR";
  createdAt: Date;
  updatedAt: Date;
}

// Shipping address schema.
const orderAddressSchema = new Schema<OrderAddress>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    addressLine2: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    landmark: {
      type: String,
      trim: true,
      maxlength: 120,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    postalCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 12,
    },

    country: {
      type: String,
      required: true,
      default: "India",
    },
  },
  { _id: false },
);

// Product snapshot schema.
const orderLineItemSchema = new Schema<OrderLineItem>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "VendorProfile",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
    },

    productSlug: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },

    imageUrl: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    unitPricePaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    lineTotalPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
  },
  { _id: false },
);

// Vendor-specific order schema.
const sellerOrderSchema = new Schema<SellerOrder>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "VendorProfile",
      required: true,
    },

    storeName: {
      type: String,
      required: true,
      trim: true,
    },

    storeSlug: {
      type: String,
      required: true,
      trim: true,
    },

    fulfillmentStatus: {
      type: String,
      enum: FULFILLMENT_STATUSES,
      default: "PENDING",
      required: true,
    },

    items: {
      type: [orderLineItemSchema],
      required: true,
      validate: {
        validator: (items: OrderLineItem[]) => items.length > 0,
        message: "A seller order must contain at least one item.",
      },
    },

    subtotalPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
  },
  { _id: true },
);

// Payment schema.
const orderPaymentSchema = new Schema<OrderPayment>(
  {
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "PENDING",
      required: true,
    },

    provider: {
      type: String,
      trim: true,
    },

    providerOrderId: {
      type: String,
      trim: true,
    },

    providerPaymentId: {
      type: String,
      trim: true,
    },

    paidAt: {
      type: Date,
    },
  },
  { _id: false },
);

// Main order schema.
const orderSchema = new Schema<Order>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ORDER_STATUSES,
      default: "PENDING_PAYMENT",
      required: true,
    },

    payment: {
      type: orderPaymentSchema,
      required: true,
    },

    shippingAddress: {
      type: orderAddressSchema,
      required: true,
    },

    sellerOrders: {
      type: [sellerOrderSchema],
      required: true,
      validate: {
        validator: (orders: SellerOrder[]) => orders.length > 0,
        message: "An order must contain at least one seller order.",
      },
    },

    subtotalPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    shippingFeePaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },

    discountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isInteger,
    },

    totalPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Helpful database indexes.
orderSchema.index({
  customer: 1,
  createdAt: -1,
});

orderSchema.index({
  "sellerOrders.vendorId": 1,
  createdAt: -1,
});

orderSchema.index({
  status: 1,
  createdAt: -1,
});

export const OrderModel =
  mongoose.models.Order ||
  mongoose.model<Order>("Order", orderSchema);
