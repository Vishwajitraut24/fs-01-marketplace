
import { Router } from "express";

import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../services/payment.service.js";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

const router = Router();

// Only authenticated customers and vendors can make purchases.
router.use(
  authenticate,
  requireRoles("CUSTOMER", "VENDOR"),
);

// CREATE RAZORPAY PAYMENT ORDER
router.post("/razorpay/order", async (request, response) => {
  const result = await createRazorpayOrder(
    request.auth!.userId,
    request.body,
  );

  response.status(201).json({
    success: true,
    message: "Razorpay payment order created successfully",
    data: result,
  });
});

// VERIFY RAZORPAY PAYMENT
router.post("/razorpay/verify", async (request, response) => {
  const result = await verifyRazorpayPayment(
    request.auth!.userId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Payment verified successfully",
    data: result,
  });
});

export default router;
