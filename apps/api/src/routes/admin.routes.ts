import { Router } from "express";

import { authenticate, requireRoles } from "../middleware/auth.middleware.js";
import {
  approveVendor,
  getPendingVendors,
  rejectVendor,
} from "../services/admin-vendor.service.js";
import {
  createCoupon,
  getCoupons,
  deactivateCoupon,
} from "../services/coupon.service.js";

import { AppError } from "../middleware/app-error.js";

import {
  getAdminAnalytics,
} from "../services/analytics.service.js";

const router = Router();

// Only authenticated ADMIN users can access these routes.
router.use(authenticate, requireRoles("ADMIN"));

// List pending vendor applications.
router.get("/vendors/pending", async (request, response) => {
  const page = Math.max(1, Number(request.query.page) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(request.query.limit) || 20),
  );

  const result = await getPendingVendors(page, limit);

  response.status(200).json({
    success: true,
    data: result,
  });
});

// Approve a vendor application.
router.post("/vendors/:vendorId/approve", async (request, response) => {
  const result = await approveVendor(
    request.params.vendorId,
    request.auth!.userId,
  );

  response.status(200).json({
    success: true,
    message: "Vendor application approved successfully",
    data: result,
  });
});

// Reject a vendor application.
router.post("/vendors/:vendorId/reject", async (request, response) => {
  const result = await rejectVendor(
    request.params.vendorId,
    request.auth!.userId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Vendor application rejected successfully",
    data: result,
  });
});

// ADMIN ANALYTICS DASHBOARD
router.get("/analytics/overview", async (_request, response) => {
  const analytics = await getAdminAnalytics();

  response.status(200).json({
    success: true,
    data: analytics,
  });
});

export default router;
// GET ALL COUPONS - ADMIN
router.get("/coupons", async (_request, response) => {
  const coupons = await getCoupons();

  response.status(200).json({
    success: true,
    data: coupons,
  });
});

// CREATE COUPON - ADMIN
router.post("/coupons", async (request, response) => {
  const coupon = await createCoupon(
    request.auth!.userId,
    request.body,
  );

  response.status(201).json({
    success: true,
    message: "Coupon created successfully.",
    data: coupon,
  });
});

// DEACTIVATE COUPON - ADMIN
router.patch(
  "/coupons/:couponId/deactivate",
  async (request, response) => {
    const couponId = request.params.couponId;

    if (typeof couponId !== "string") {
      throw new AppError(
        400,
        "INVALID_COUPON_ID",
        "Invalid coupon ID.",
      );
    }

    const coupon = await deactivateCoupon(couponId);

    response.status(200).json({
      success: true,
      message: "Coupon deactivated successfully.",
      data: coupon,
    });
  },
);