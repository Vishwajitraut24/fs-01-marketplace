import { Router } from "express";

import { authenticate, requireRoles } from "../middleware/auth.middleware.js";
import {
  approveVendor,
  getPendingVendors,
  rejectVendor,
} from "../services/admin-vendor.service.js";

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

export default router;