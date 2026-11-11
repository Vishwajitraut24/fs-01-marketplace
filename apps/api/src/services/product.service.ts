
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";

import { ProductModel, PRODUCT_STATUSES } from "../models/product.model.js";
import type { ProductStatus } from "../models/product.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { AppError } from "../middleware/app-error.js";
import { syncProductToSearch } from "./product-search.service.js";

// Validate product images.
const productImageSchema = z.object({
  url: z.string().url().max(2048),
  altText: z.string().trim().min(1).max(200),
  storageKey: z.string().trim().max(500).optional(),
});

// Validate product details.
const productInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(5000),
  category: z.string().trim().min(1).max(100),
  brand: z.string().trim().max(100).optional(),
  sku: z.string().trim().min(1).max(80),
  pricePaise: z.number().int().positive(),
  compareAtPricePaise: z.number().int().positive().optional(),
  inventoryQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  images: z.array(productImageSchema).max(10).default([]),
});

// Validate product updates.
const productUpdateSchema = productInputSchema
  .partial()
  .extend({
    status: z.enum(PRODUCT_STATUSES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided.",
  });

// Check whether a MongoDB duplicate-key error occurred.
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

// Generate a URL-friendly product slug.
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const suffix = randomBytes(3).toString("hex");

  return `${base || "product"}-${suffix}`;
}

// Find the approved vendor belonging to the logged-in user.
async function getApprovedVendor(userId: string) {
  const vendor = await VendorModel.findOne({
    owner: userId,
    status: "APPROVED",
  }).select("_id");

  if (!vendor) {
    throw new AppError(
      403,
      "VENDOR_NOT_APPROVED",
      "Only approved vendors can manage products.",
    );
  }

  return vendor;
}

// Validate the product ID.
function validateProductId(productId: string): void {
  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError(
      400,
      "INVALID_PRODUCT_ID",
      "The provided product ID is invalid.",
    );
  }
}

// CREATE PRODUCT
export async function createProduct(
  userId: string,
  input: unknown,
) {
  const data = productInputSchema.parse(input);

  const vendor = await getApprovedVendor(userId);

  try {
    const product = await ProductModel.create({
  ...data,
  vendor: vendor._id,
  slug: generateSlug(data.name),
  sku: data.sku.toUpperCase(),
  status: "DRAFT",
});

await syncProductToSearch(product._id.toString());

return product;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "PRODUCT_CONFLICT",
        "A product with this SKU already exists in your store.",
      );
    }

    throw error;
  }
}

// LIST PRODUCTS OWNED BY THE LOGGED-IN VENDOR
export async function getVendorProducts(
  userId: string,
  page = 1,
  limit = 20,
  status?: ProductStatus,
) {
  const vendor = await getApprovedVendor(userId);

  const safePage = Number.isFinite(page)
    ? Math.max(1, Math.floor(page))
    : 1;

  const safeLimit = Number.isFinite(limit)
    ? Math.min(100, Math.max(1, Math.floor(limit)))
    : 20;

  const filter: {
    vendor: mongoose.Types.ObjectId;
    status?: ProductStatus;
  } = {
    vendor: vendor._id,
  };

  if (status) {
    filter.status = status;
  }

  const [items, total] = await Promise.all([
    ProductModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),

    ProductModel.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

// UPDATE A PRODUCT
export async function updateProduct(
  userId: string,
  productId: string,
  input: unknown,
) {
  validateProductId(productId);

  const data = productUpdateSchema.parse(input);

  const vendor = await getApprovedVendor(userId);

  const product = await ProductModel.findOne({
    _id: productId,
    vendor: vendor._id,
  });

  if (!product) {
    throw new AppError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found in your store.",
    );
  }

  Object.assign(product, data);

  if (data.status === "ACTIVE" && !product.publishedAt) {
    product.publishedAt = new Date();
  }

  if (data.status && data.status !== "ACTIVE") {
    product.publishedAt = undefined;
  }

  try {
      await product.save();
     await syncProductToSearch(product._id.toString());
     return product;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "PRODUCT_CONFLICT",
        "A product with this SKU already exists in your store.",
      );
    }

    throw error;
  }
}

// ARCHIVE A PRODUCT INSTEAD OF PERMANENTLY DELETING IT.
export async function deleteProduct(
  userId: string,
  productId: string,
) {
  validateProductId(productId);

  const vendor = await getApprovedVendor(userId);

  const product = await ProductModel.findOne({
    _id: productId,
    vendor: vendor._id,
  });

  if (!product) {
    throw new AppError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found in your store.",
    );
  }

  product.status = "ARCHIVED";
  product.publishedAt = undefined;

  await product.save();

await syncProductToSearch(product._id.toString());

return {
  id: product._id,
  name: product.name,
  status: product.status,
};
}
