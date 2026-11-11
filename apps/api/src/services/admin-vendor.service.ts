
import mongoose from "mongoose";
import { z } from "zod";

import { VendorModel } from "../models/vendor.model.js";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../middleware/app-error.js";
import { syncVendorProducts } from "./product-search.service.js";

// Validate vendor application IDs.
const vendorIdSchema = z.string().refine(
  (value) => mongoose.isValidObjectId(value),
  "Invalid vendor application ID.",
);

// Validate rejection reason.
const rejectionSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

// Retrieve pending vendor applications with pagination.
export async function getPendingVendors(
  page = 1,
  limit = 20,
) {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(50, Math.max(1, Math.floor(limit)));

  const [vendors, total] = await Promise.all([
    VendorModel.find({ status: "PENDING" })
      .select(
        "owner storeName storeSlug description contactEmail contactPhone status createdAt",
      )
      .populate("owner", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean()
      .exec(),

    VendorModel.countDocuments({ status: "PENDING" }),
  ]);

  return {
    items: vendors,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

// Approve a vendor application and promote its owner.
export async function approveVendor(
  vendorId: string,
  adminUserId: string,
) {
  vendorIdSchema.parse(vendorId);

  if (!mongoose.isValidObjectId(adminUserId)) {
    throw new AppError(
      400,
      "INVALID_ADMIN_ID",
      "Invalid administrator ID.",
    );
  }

  const session = await mongoose.startSession();

  let approvedVendor:
    | {
        id: string;
        storeName: string;
        storeSlug: string;
        status: string;
        ownerId: string;
      }
    | undefined;

  try {
    await session.withTransaction(async () => {
      // Find the application.
      const vendor = await VendorModel.findById(vendorId)
        .session(session)
        .exec();

      if (!vendor) {
        throw new AppError(
          404,
          "VENDOR_NOT_FOUND",
          "Vendor application was not found.",
        );
      }

      if (vendor.status !== "PENDING") {
        throw new AppError(
          409,
          "APPLICATION_ALREADY_REVIEWED",
          "This vendor application has already been reviewed.",
        );
      }

      // Load the applicant.
      const user = await UserModel.findById(vendor.owner)
        .session(session)
        .exec();

      if (!user || user.status !== "ACTIVE") {
        throw new AppError(
          409,
          "VENDOR_ACCOUNT_UNAVAILABLE",
          "The applicant account is unavailable.",
        );
      }

      if (user.role !== "CUSTOMER") {
        throw new AppError(
          409,
          "INVALID_APPLICANT_ROLE",
          "Only customer accounts can be approved as vendors.",
        );
      }

      // Update vendor application.
      const reviewedAt = new Date();

      vendor.status = "APPROVED";
      vendor.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
      vendor.reviewedAt = reviewedAt;
      vendor.rejectionReason = null;

      await vendor.save({ session });

      // Promote the customer to vendor.
      user.role = "VENDOR";

      await user.save({ session });

      approvedVendor = {
        id: vendor._id.toString(),
        storeName: vendor.storeName,
        storeSlug: vendor.storeSlug,
        status: vendor.status,
        ownerId: user._id.toString(),
      };
    });
  } finally {
    await session.endSession();
  }

  if (!approvedVendor) {
  throw new AppError(
    500,
    "APPROVAL_FAILED",
    "Vendor approval could not be completed.",
  );
}

// Synchronize the vendor's existing products after approval.
await syncVendorProducts(approvedVendor.id);

return approvedVendor;
}

// Reject a vendor application.
export async function rejectVendor(
  vendorId: string,
  adminUserId: string,
  input: unknown,
) {
  vendorIdSchema.parse(vendorId);

  if (!mongoose.isValidObjectId(adminUserId)) {
    throw new AppError(
      400,
      "INVALID_ADMIN_ID",
      "Invalid administrator ID.",
    );
  }

  const { reason } = rejectionSchema.parse(input);

  const session = await mongoose.startSession();

  let rejectedVendor:
    | {
        id: string;
        storeName: string;
        status: string;
        rejectionReason: string;
      }
    | undefined;

  try {
    await session.withTransaction(async () => {
      const vendor = await VendorModel.findById(vendorId)
        .session(session)
        .exec();

      if (!vendor) {
        throw new AppError(
          404,
          "VENDOR_NOT_FOUND",
          "Vendor application was not found.",
        );
      }

      if (vendor.status !== "PENDING") {
        throw new AppError(
          409,
          "APPLICATION_ALREADY_REVIEWED",
          "This vendor application has already been reviewed.",
        );
      }

      vendor.status = "REJECTED";
      vendor.rejectionReason = reason;
      vendor.reviewedBy = new mongoose.Types.ObjectId(adminUserId);
      vendor.reviewedAt = new Date();

      await vendor.save({ session });

      // The applicant remains a CUSTOMER.
      rejectedVendor = {
        id: vendor._id.toString(),
        storeName: vendor.storeName,
        status: vendor.status,
        rejectionReason: reason,
      };
    });
  } finally {
    await session.endSession();
  }

  if (!rejectedVendor) {
    throw new AppError(
      500,
      "REJECTION_FAILED",
      "Vendor rejection could not be completed.",
    );
  }

  return rejectedVendor;
}
