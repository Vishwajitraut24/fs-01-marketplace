import mongoose, { Schema } from "mongoose";

export const COUPON_TYPES = [
  "PERCENTAGE",
  "FIXED",
] as const;

export type CouponType = (typeof COUPON_TYPES)[number];

export interface Coupon {
  code: string;
  type: CouponType;
  value: number;
  maxDiscountPaise?: number;
  minOrderPaise: number;
  startsAt: Date;
  expiresAt: Date;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<Coupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    type: {
      type: String,
      enum: COUPON_TYPES,
      required: true,
    },

    value: {
      type: Number,
      required: true,
      min: 1,
    },

    maxDiscountPaise: {
      type: Number,
      min: 1,
    },

    minOrderPaise: {
      type: Number,
      default: 0,
      min: 0,
    },

    startsAt: {
      type: Date,
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    perCustomerLimit: {
      type: Number,
      default: 1,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

couponSchema.index({
  isActive: 1,
  startsAt: 1,
  expiresAt: 1,
});

export const CouponModel =
  mongoose.models.Coupon ||
  mongoose.model<Coupon>("Coupon", couponSchema);