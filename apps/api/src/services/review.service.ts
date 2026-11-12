import mongoose from "mongoose";
import { z } from "zod";

import { ReviewModel } from "../models/review.model.js";
import { ProductModel } from "../models/product.model.js";
import { OrderModel } from "../models/order.model.js";
import { AppError } from "../middleware/app-error.js";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  comment: z.string().trim().min(10).max(2000),
});

function validateId(id: string, label: string): void {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(
      400,
      "INVALID_ID",
      `Invalid ${label}.`,
    );
  }
}

// CREATE REVIEW
export async function createReview(
  userId: string,
  productId: string,
  input: unknown,
) {
  validateId(productId, "product ID");

  const data = reviewSchema.parse(input);

  const product = await ProductModel.findOne({
    _id: productId,
    status: "ACTIVE",
  }).select("_id");

  if (!product) {
    throw new AppError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found.",
    );
  }

  // The customer must have received this product.
  const deliveredOrder = await OrderModel.findOne({
    customer: userId,
    sellerOrders: {
      $elemMatch: {
        fulfillmentStatus: "DELIVERED",
        items: {
          $elemMatch: {
            productId: product._id,
          },
        },
      },
    },
  })
    .select("_id")
    .lean();

  if (!deliveredOrder) {
    throw new AppError(
      403,
      "PURCHASE_NOT_VERIFIED",
      "You can review this product only after it has been delivered to you.",
    );
  }

  try {
    const review = await ReviewModel.create({
      product: product._id,
      customer: new mongoose.Types.ObjectId(userId),
      order: deliveredOrder._id,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      verifiedPurchase: true,
    });

    return review;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        409,
        "REVIEW_ALREADY_EXISTS",
        "You have already reviewed this product.",
      );
    }

    throw error;
  }
}

// GET PRODUCT REVIEWS
export async function getProductReviews(
  productId: string,
  page = 1,
  limit = 10,
) {
  validateId(productId, "product ID");

  const productObjectId =
    new mongoose.Types.ObjectId(productId);

  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(
    50,
    Math.max(1, Math.floor(limit)),
  );

  const filter = {
    product: productObjectId,
  };

  const [reviews, total, statistics] = await Promise.all([
    ReviewModel.find(filter)
      .select("rating title comment verifiedPurchase createdAt")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    ReviewModel.countDocuments(filter),

    ReviewModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]),
  ]);

  return {
    reviews,
    statistics: {
      averageRating:
        statistics[0]?.averageRating ?? 0,
      totalReviews: total,
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

// EDIT OWN REVIEW
export async function updateReview(
  userId: string,
  reviewId: string,
  input: unknown,
) {
  validateId(reviewId, "review ID");

  const data = reviewSchema.parse(input);

  const review = await ReviewModel.findOne({
    _id: reviewId,
    customer: userId,
  });

  if (!review) {
    throw new AppError(
      404,
      "REVIEW_NOT_FOUND",
      "Review not found.",
    );
  }

  review.rating = data.rating;
  review.title = data.title;
  review.comment = data.comment;

  await review.save();

  return review;
}

// DELETE OWN REVIEW
export async function deleteReview(
  userId: string,
  reviewId: string,
) {
  validateId(reviewId, "review ID");

  const review = await ReviewModel.findOneAndDelete({
    _id: reviewId,
    customer: userId,
  });

  if (!review) {
    throw new AppError(
      404,
      "REVIEW_NOT_FOUND",
      "Review not found.",
    );
  }

  return {
    success: true,
    message: "Review deleted successfully.",
  };
}