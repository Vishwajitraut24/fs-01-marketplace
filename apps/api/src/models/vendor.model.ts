
import mongoose, { Schema } from "mongoose";

export const VENDOR_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;

export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export interface VendorProfile {
  owner: mongoose.Types.ObjectId;
  storeName: string;
  storeSlug: string;
  description: string;
  contactEmail: string;
  contactPhone: string;
  status: VendorStatus;
  rejectionReason?: string | null;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<VendorProfile>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    storeSlug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 1000,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    status: {
      type: String,
      enum: VENDOR_STATUSES,
      default: "PENDING",
      required: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      maxlength: 500,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

vendorSchema.index({ status: 1, createdAt: -1 });

export const VendorModel =
  mongoose.models.VendorProfile ||
  mongoose.model<VendorProfile>("VendorProfile", vendorSchema);
