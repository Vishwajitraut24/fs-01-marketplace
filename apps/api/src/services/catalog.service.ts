
import mongoose from "mongoose";
import { z } from "zod";

import { ProductModel } from "../models/product.model.js";
import { VendorModel } from "../models/vendor.model.js";
import { AppError } from "../middleware/app-error.js";

import { searchProductIds } from "./product-search.service.js";

// Validate public product catalog filters.
const catalogQuerySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),

  category: z.string().trim().min(1).max(100).optional(),

  minPricePaise: z.coerce.number().int().min(0).optional(),

  maxPricePaise: z.coerce.number().int().min(0).optional(),

  sort: z
    .enum(["newest", "price_asc", "price_desc"])
    .default("newest"),

  page: z.coerce.number().int().min(1).default(1),

  limit: z.coerce.number().int().min(1).max(50).default(20),
}).refine(
  (data) =>
    data.minPricePaise === undefined ||
    data.maxPricePaise === undefined ||
    data.maxPricePaise >= data.minPricePaise,
  {
    message: "Maximum price must be greater than or equal to minimum price.",
  },
);

// Escape special characters in search input.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Fields safe to expose in the public catalog.
const publicProductProjection = {
  _id: 1,
  name: 1,
  slug: 1,
  description: 1,
  category: 1,
  brand: 1,
  pricePaise: 1,
  compareAtPricePaise: 1,
  currency: 1,
  images: 1,
  status: 1,
  publishedAt: 1,
  createdAt: 1,

  inStock: {
    $gt: ["$inventoryQuantity", 0],
  },

  vendor: {
    _id: "$vendorInfo._id",
    storeName: "$vendorInfo.storeName",
    storeSlug: "$vendorInfo.storeSlug",
  },
};

// GET PUBLIC PRODUCT CATALOG.
export async function getPublicProducts(input: unknown) {
  const filters = catalogQuerySchema.parse(input);

  const match: Record<string, unknown> = {
    status: "ACTIVE",
  };

  if (filters.category) {
    match.category = new RegExp(
      `^${escapeRegex(filters.category)}$`,
      "i",
    );
  }

  if (filters.q) {
  const elasticsearchIds = await searchProductIds(filters.q);

  const validProductIds = elasticsearchIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (validProductIds.length > 0) {
    // Elasticsearch is the primary search engine.
    match._id = { $in: validProductIds };
  } else {
    // MongoDB fallback when Elasticsearch has no results.
    const search = new RegExp(
      escapeRegex(filters.q),
      "i",
    );

    match.$or = [
      { name: search },
      { description: search },
      { brand: search },
      { category: search },
    ];
  }
}

  if (
    filters.minPricePaise !== undefined ||
    filters.maxPricePaise !== undefined
  ) {
    const priceRange: {
      $gte?: number;
      $lte?: number;
    } = {};

    if (filters.minPricePaise !== undefined) {
      priceRange.$gte = filters.minPricePaise;
    }

    if (filters.maxPricePaise !== undefined) {
      priceRange.$lte = filters.maxPricePaise;
    }

    match.pricePaise = priceRange;
  }

const sort: Record<string, 1 | -1> =
  filters.sort === "price_asc"
    ? { pricePaise: 1 }
    : filters.sort === "price_desc"
      ? { pricePaise: -1 }
      : { createdAt: -1 };

  const skip = (filters.page - 1) * filters.limit;

  const [result] = await ProductModel.aggregate([
    {
      $match: match,
    },
    {
      $lookup: {
        from: VendorModel.collection.name,
        localField: "vendor",
        foreignField: "_id",
        as: "vendorInfo",
      },
    },
    {
      $unwind: "$vendorInfo",
    },
    {
      $match: {
        "vendorInfo.status": "APPROVED",
      },
    },
    {
      $facet: {
        items: [
          {
            $sort: sort,
          },
          {
            $skip: skip,
          },
          {
            $limit: filters.limit,
          },
          {
            $project: publicProductProjection,
          },
        ],
        metadata: [
          {
            $count: "total",
          },
        ],
      },
    },
  ]);

  const items = result?.items ?? [];
  const total = result?.metadata?.[0]?.total ?? 0;

  return {
    items,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.ceil(total / filters.limit),
    },
  };
}

// GET ONE PUBLIC PRODUCT BY ID.
export async function getPublicProductById(productId: string) {
  if (!mongoose.isValidObjectId(productId)) {
    throw new AppError(
      400,
      "INVALID_PRODUCT_ID",
      "The provided product ID is invalid.",
    );
  }

  const [product] = await ProductModel.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(productId),
        status: "ACTIVE",
      },
    },
    {
      $lookup: {
        from: VendorModel.collection.name,
        localField: "vendor",
        foreignField: "_id",
        as: "vendorInfo",
      },
    },
    {
      $unwind: "$vendorInfo",
    },
    {
      $match: {
        "vendorInfo.status": "APPROVED",
      },
    },
    {
      $project: publicProductProjection,
    },
  ]);

  if (!product) {
    throw new AppError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found or is not publicly available.",
    );
  }

  return product;
}
