import { Router } from "express";

import {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
} from "../services/review.service.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { AppError } from "../middleware/app-error.js";

const router = Router();
function getRouteParam(
  value: string | string[],
  label: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      400,
      "INVALID_ROUTE_PARAMETER",
      `Invalid ${label}.`,
    );
  }

  return value;
}
// Public product reviews.
router.get("/:productId/reviews", async (request, response) => {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 10);

  const result = await getProductReviews(
    getRouteParam(request.params.productId, "product ID"),
    page,
    limit,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
});

// Submit verified review.
router.post(
  "/:productId/reviews",
  authenticate,
  async (request, response) => {
    const result = await createReview(
      request.auth!.userId,
      getRouteParam(request.params.reviewId, "review ID"),
      request.body,
    );

    response.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      data: result,
    });
  },
);

// Edit own review.
router.patch(
  "/reviews/:reviewId",
  authenticate,
  async (request, response) => {
    const result = await updateReview(
      request.auth!.userId,
      getRouteParam(request.params.reviewId, "review ID"),
      request.body,
    );

    response.status(200).json({
      success: true,
      message: "Review updated successfully.",
      data: result,
    });
  },
);

// Delete own review.
router.delete(
  "/reviews/:reviewId",
  authenticate,
  async (request, response) => {
    const result = await deleteReview(
      request.auth!.userId,
      getRouteParam(request.params.reviewId, "review ID"),
    );

    response.status(200).json(result);
  },
);

export default router;