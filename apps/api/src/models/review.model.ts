import mongoose, { Schema } from "mongoose";

export interface ProductReview {
  product: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<ProductReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
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

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    verifiedPurchase: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// One review per customer for each product.
reviewSchema.index(
  { product: 1, customer: 1 },
  { unique: true },
);

reviewSchema.index({
  product: 1,
  createdAt: -1,
});

export const ReviewModel =
  mongoose.models.ProductReview ||
  mongoose.model<ProductReview>("ProductReview", reviewSchema);