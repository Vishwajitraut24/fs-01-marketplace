import mongoose, { Schema } from "mongoose";

export interface CouponRedemption {
  coupon: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  discountPaise: number;
  createdAt: Date;
}

const redemptionSchema = new Schema<CouponRedemption>(
  {
    coupon: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      required: true,
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    discountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

redemptionSchema.index(
  { coupon: 1, order: 1 },
  { unique: true },
);

redemptionSchema.index({
  coupon: 1,
  customer: 1,
});

export const CouponRedemptionModel =
  mongoose.models.CouponRedemption ||
  mongoose.model<CouponRedemption>(
    "CouponRedemption",
    redemptionSchema,
  );