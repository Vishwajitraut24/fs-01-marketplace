
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { VendorModel } from "../models/vendor.model.js";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../middleware/app-error.js";

// Validate vendor application details.
export const vendorApplicationSchema = z.object({
  storeName: z.string().trim().min(2).max(100),

  description: z
    .string()
    .trim()
    .min(20, "Store description must contain at least 20 characters.")
    .max(1000),

  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(254),

  contactPhone: z
    .string()
    .trim()
    .regex(
      /^[+]?[\d\s().-]{8,20}$/,
      "Enter a valid contact phone number.",
    ),
});

export type VendorApplicationInput = z.infer<
  typeof vendorApplicationSchema
>;

// Generate a URL-friendly store identifier.
function generateStoreSlug(storeName: string): string {
  const baseSlug = storeName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  return `${baseSlug || "store"}-${randomBytes(3).toString("hex")}`;
}

// Submit a vendor application.
export async function createVendorApplication(
  userId: string,
  input: unknown,
) {
  const data = vendorApplicationSchema.parse(input);

  // Confirm that the applicant exists and is a customer.
  const user = await UserModel.findById(userId)
    .select("role status")
    .exec();

  if (!user || user.status !== "ACTIVE") {
    throw new AppError(
      401,
      "INVALID_ACCOUNT",
      "Your account is unavailable.",
    );
  }

  if (user.role !== "CUSTOMER") {
    throw new AppError(
      403,
      "CUSTOMER_ACCOUNT_REQUIRED",
      "Only customer accounts can submit vendor applications.",
    );
  }

  // Each user can have only one vendor profile.
  const existingApplication = await VendorModel.exists({
    owner: user._id,
  });

  if (existingApplication) {
    throw new AppError(
      409,
      "VENDOR_APPLICATION_EXISTS",
      "You already have a vendor application.",
    );
  }

  try {
    const vendor = await VendorModel.create({
      owner: user._id,
      storeName: data.storeName,
      storeSlug: generateStoreSlug(data.storeName),
      description: data.description,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      status: "PENDING",
    });

    return {
      id: vendor._id.toString(),
      storeName: vendor.storeName,
      storeSlug: vendor.storeSlug,
      description: vendor.description,
      contactEmail: vendor.contactEmail,
      contactPhone: vendor.contactPhone,
      status: vendor.status,
      createdAt: vendor.createdAt,
    };
  } catch (error: unknown) {
    // Handle duplicate owner or store slug conflicts.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        409,
        "VENDOR_APPLICATION_EXISTS",
        "A vendor application or store identifier already exists.",
      );
    }

    throw error;
  }
}
