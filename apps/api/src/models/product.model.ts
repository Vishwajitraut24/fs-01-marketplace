
import mongoose, { Schema } from "mongoose";

// Available product statuses.
export const PRODUCT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// Product image structure.
export interface ProductImage {
  url: string;
  altText: string;
  storageKey?: string;
}

// Product structure.
export interface Product {
  vendor: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  category: string;
  brand?: string;
  sku: string;
  pricePaise: number;
  compareAtPricePaise?: number;
  currency: "INR";
  inventoryQuantity: number;
  lowStockThreshold: number;
  images: ProductImage[];
  status: ProductStatus;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Product image schema.
const productImageSchema = new Schema<ProductImage>(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    altText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    storageKey: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  },
);

// Main product schema.
const productSchema = new Schema<Product>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "VendorProfile",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 5000,
    },

    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    brand: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },

    // Store money in paise to avoid decimal precision problems.
    // Example: ₹499 = 49900 paise.
    pricePaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Price must be an integer number of paise.",
      },
    },

    compareAtPricePaise: {
      type: Number,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Compare-at price must be an integer number of paise.",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    inventoryQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Inventory quantity must be an integer.",
      },
    },

    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Low stock threshold must be an integer.",
      },
    },

    images: {
      type: [productImageSchema],
      default: [],
    },

    status: {
      type: String,
      enum: PRODUCT_STATUSES,
      default: "DRAFT",
      required: true,
    },

    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// A vendor cannot create duplicate product slugs or SKUs.
productSchema.index(
  { vendor: 1, slug: 1 },
  { unique: true },
);

productSchema.index(
  { vendor: 1, sku: 1 },
  { unique: true },
);

// Helpful indexes for vendor product management.
productSchema.index({
  vendor: 1,
  status: 1,
  createdAt: -1,
});

export const ProductModel =
  mongoose.models.Product ||
  mongoose.model<Product>("Product", productSchema);
