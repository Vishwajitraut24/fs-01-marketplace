
import { Router } from "express";

import {
  getVendorOrders,
  getVendorOrderById,
  updateVendorOrderStatus,
} from "../services/vendor-order.service.js";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

import { AppError } from "../middleware/app-error.js";

const router = Router();

// Only authenticated VENDOR accounts can access these routes.
// The service also verifies that the vendor is APPROVED.
router.use(authenticate, requireRoles("VENDOR"));

// GET VENDOR ORDER HISTORY
router.get("/", async (request, response) => {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    throw new AppError(
      400,
      "INVALID_PAGINATION",
      "Page must be positive and limit must be between 1 and 100.",
    );
  }

  const result = await getVendorOrders(
    request.auth!.userId,
    page,
    limit,
  );

  response.status(200).json({
    success: true,
    message: "Vendor orders retrieved successfully",
    data: result,
  });
});

// GET ONE VENDOR ORDER
router.get("/:orderId", async (request, response) => {
  const order = await getVendorOrderById(
    request.auth!.userId,
    request.params.orderId,
  );

  response.status(200).json({
    success: true,
    message: "Vendor order details retrieved successfully",
    data: order,
  });
});

// UPDATE VENDOR FULFILLMENT STATUS
router.patch("/:orderId/status", async (request, response) => {
  const result = await updateVendorOrderStatus(
    request.auth!.userId,
    request.params.orderId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Vendor order status updated successfully",
    data: result,
  });
});

export default router;
