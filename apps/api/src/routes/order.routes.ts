import { Router } from "express";

import {
  createOrder,
  getCustomerOrders,
  getCustomerOrderById,
} from "../services/order.service.js";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

import { AppError } from "../middleware/app-error.js";
import {
  generateCustomerInvoice,
} from "../services/invoice.service.js";

const router = Router();

// Only authenticated customers and vendors can access orders.
router.use(
  authenticate,
  requireRoles("CUSTOMER", "VENDOR"),
);

// CREATE ORDER / CHECKOUT
router.post("/", async (request, response) => {
  const order = await createOrder(
    request.auth!.userId,
    request.body,
  );

  response.status(201).json({
    success: true,
    message: "Order created successfully",
    data: order,
  });
});

// GET CUSTOMER ORDER HISTORY
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

  const result = await getCustomerOrders(
    request.auth!.userId,
    page,
    limit,
  );

  response.status(200).json({
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

// DOWNLOAD CUSTOMER ORDER INVOICE
router.get("/:orderId/invoice", async (request, response) => {
  const orderId = request.params.orderId;

  if (typeof orderId !== "string") {
    throw new AppError(
      400,
      "INVALID_ORDER_ID",
      "Invalid order ID.",
    );
  }

  const pdf = await generateCustomerInvoice(
    request.auth!.userId,
    orderId,
  );

  response.setHeader(
    "Content-Type",
    "application/pdf",
  );

  response.setHeader(
    "Content-Disposition",
    `attachment; filename="invoice-${orderId}.pdf"`,
  );

  response.setHeader(
    "Content-Length",
    pdf.length,
  );

  response.status(200).send(pdf);
});

// GET ONE CUSTOMER ORDER
router.get("/:orderId", async (request, response) => {
  const order = await getCustomerOrderById(
    request.auth!.userId,
    request.params.orderId,
  );

  response.status(200).json({
    success: true,
    message: "Order details retrieved successfully",
    data: order,
  });
});

export default router;
