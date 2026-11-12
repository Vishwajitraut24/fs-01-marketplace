import mongoose from "mongoose";
import { z } from "zod";

import { CouponModel } from "../models/coupon.model.js";
import { AppError } from "../middleware/app-error.js";

const createCouponSchema = z.object({
  code: z.string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/)
    .transform((value) => value.toUpperCase()),

  type: z.enum(["PERCENTAGE", "FIXED"]),

  value: z.number().int().positive(),

  maxDiscountPaise: z.number().int().positive().optional(),

  minOrderPaise: z.number().int().min(0).default(0),

  startsAt: z.coerce.date().optional(),

  expiresAt: z.coerce.date(),

  usageLimit: z.number().int().positive().nullable().optional(),

  perCustomerLimit: z.number().int().positive().max(10).default(1),
}).superRefine((data, context) => {
  if (data.type === "PERCENTAGE" && data.value > 100) {
    context.addIssue({
      code: "custom",
      path: ["value"],
      message: "Percentage discount cannot exceed 100.",
    });
  }

  if (
    data.type === "FIXED" &&
    data.maxDiscountPaise !== undefined
  ) {
    context.addIssue({
      code: "custom",
      path: ["maxDiscountPaise"],
      message: "Maximum discount is only used for percentage coupons.",
    });
  }

  const start = data.startsAt ?? new Date();

  if (data.expiresAt <= start) {
    context.addIssue({
      code: "custom",
      path: ["expiresAt"],
      message: "Expiry must be after the start date.",
    });
  }
});

// CREATE COUPON - ADMIN
export async function createCoupon(
  adminId: string,
  input: unknown,
) {
  const data = createCouponSchema.parse(input);

  try {
    return await CouponModel.create({
      ...data,
      startsAt: data.startsAt ?? new Date(),
      createdBy: new mongoose.Types.ObjectId(adminId),
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        409,
        "COUPON_EXISTS",
        "A coupon with this code already exists.",
      );
    }

    throw error;
  }
}

// LIST COUPONS - ADMIN
export async function getCoupons() {
  return CouponModel.find()
    .sort({ createdAt: -1 })
    .lean();
}

// DEACTIVATE COUPON - ADMIN
export async function deactivateCoupon(couponId: string) {
  if (!mongoose.isValidObjectId(couponId)) {
    throw new AppError(
      400,
      "INVALID_COUPON_ID",
      "Invalid coupon ID.",
    );
  }

  const coupon = await CouponModel.findByIdAndUpdate(
    couponId,
    { $set: { isActive: false } },
    { new: true },
  );

  if (!coupon) {
    throw new AppError(
      404,
      "COUPON_NOT_FOUND",
      "Coupon not found.",
    );
  }

  return coupon;
}

// CALCULATE DISCOUNT
export function calculateCouponDiscount(
  coupon: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
    maxDiscountPaise?: number;
    minOrderPaise: number;
  },
  subtotalPaise: number,
): number {
  if (subtotalPaise < coupon.minOrderPaise) {
    throw new AppError(
      400,
      "MINIMUM_ORDER_NOT_MET",
      "Your order does not meet the minimum coupon value.",
    );
  }

  let discountPaise =
    coupon.type === "PERCENTAGE"
      ? Math.floor(subtotalPaise * coupon.value / 100)
      : coupon.value;

  if (coupon.maxDiscountPaise !== undefined) {
    discountPaise = Math.min(
      discountPaise,
      coupon.maxDiscountPaise,
    );
  }

  // Keep the final order amount positive.
  discountPaise = Math.min(
    discountPaise,
    Math.max(0, subtotalPaise - 1),
  );

  if (discountPaise <= 0) {
    throw new AppError(
      400,
      "INVALID_COUPON_DISCOUNT",
      "This coupon cannot be applied to the order.",
    );
  }

  return discountPaise;
}