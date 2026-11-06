
import { Router } from "express";
import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

export const accessRouter = Router();

// Customer-only protected endpoint.
accessRouter.get(
  "/customer",
  authenticate,
  requireRoles("CUSTOMER"),
  (request, response) => {
    response.status(200).json({
      success: true,
      message: "Customer access granted.",
      data: {
        userId: request.auth!.userId,
        role: request.auth!.role,
      },
    });
  },
);

// Vendor-only protected endpoint.
accessRouter.get(
  "/vendor",
  authenticate,
  requireRoles("VENDOR"),
  (request, response) => {
    response.status(200).json({
      success: true,
      message: "Vendor access granted.",
      data: {
        userId: request.auth!.userId,
        role: request.auth!.role,
      },
    });
  },
);

// Admin-only protected endpoint.
accessRouter.get(
  "/admin",
  authenticate,
  requireRoles("ADMIN"),
  (request, response) => {
    response.status(200).json({
      success: true,
      message: "Administrator access granted.",
      data: {
        userId: request.auth!.userId,
        role: request.auth!.role,
      },
    });
  },
);
