
import { Router } from "express";

import {
  createProduct,
  getVendorProducts,
  updateProduct,
  deleteProduct,
} from "../services/product.service.js";

import {
  PRODUCT_STATUSES,
} from "../models/product.model.js";

import type {
  ProductStatus,
} from "../models/product.model.js";

import {
  authenticate,
  requireRoles,
} from "../middleware/auth.middleware.js";

import { AppError } from "../middleware/app-error.js";

const router = Router();

// Only authenticated VENDOR accounts can manage products.
router.use(authenticate, requireRoles("VENDOR"));

// CREATE PRODUCT
router.post("/", async (request, response) => {
  const product = await createProduct(
    request.auth!.userId,
    request.body,
  );

  response.status(201).json({
    success: true,
    message: "Product created successfully",
    data: product,
  });
});

// GET VENDOR PRODUCTS
router.get("/", async (request, response) => {
  const page = Number(request.query.page ?? 1);
  const limit = Number(request.query.limit ?? 20);

  const rawStatus = request.query.status;
  let status: ProductStatus | undefined;

  if (rawStatus !== undefined) {
    if (
      typeof rawStatus !== "string" ||
      !PRODUCT_STATUSES.includes(rawStatus as ProductStatus)
    ) {
      throw new AppError(
        400,
        "INVALID_PRODUCT_STATUS",
        "The requested product status is invalid.",
      );
    }

    status = rawStatus as ProductStatus;
  }

  const result = await getVendorProducts(
    request.auth!.userId,
    page,
    limit,
    status,
  );

  response.status(200).json({
    success: true,
    data: result,
  });
});

// UPDATE PRODUCT
router.patch("/:productId", async (request, response) => {
  const product = await updateProduct(
    request.auth!.userId,
    request.params.productId,
    request.body,
  );

  response.status(200).json({
    success: true,
    message: "Product updated successfully",
    data: product,
  });
});

// ARCHIVE PRODUCT
router.delete("/:productId", async (request, response) => {
  const result = await deleteProduct(
    request.auth!.userId,
    request.params.productId,
  );

  response.status(200).json({
    success: true,
    message: "Product archived successfully",
    data: result,
  });
});

export default router;
