
import { Router } from "express";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

import {
  createVendorApplication,
} from "../services/vendor.service.js";

export const vendorRouter = Router();

// POST /api/v1/vendors/apply
// Only authenticated customers can apply.
vendorRouter.post(
  "/apply",
  authenticate,
  requireRoles("CUSTOMER"),
  async (request, response) => {
    const vendor = await createVendorApplication(
      request.auth!.userId,
      request.body,
    );

    response.status(201).json({
      success: true,
      message: "Vendor application submitted successfully.",
      data: { vendor },
    });
  },
);
