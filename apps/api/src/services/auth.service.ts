
import bcrypt from "bcryptjs";
import { z } from "zod";

import { UserModel } from "../models/user.model.js";
import { AppError } from "../middleware/app-error.js";
import { createAccessToken } from "../utils/tokens.js";

// Validate registration data.
export const registerCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .max(128)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "Password must not exceed 72 UTF-8 bytes."
    ),
});

export type RegisterCustomerInput = z.infer<
  typeof registerCustomerSchema
>;

// Register a new customer.
export async function registerCustomer(input: unknown) {
  const data = registerCustomerSchema.parse(input);

  // Check whether the email is already registered.
  const existingUser = await UserModel.exists({
    email: data.email,
  });

  if (existingUser) {
    throw new AppError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists."
    );
  }

  // Hash the password before saving it.
  const passwordHash = await bcrypt.hash(data.password, 12);

  try {
    const user = await UserModel.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      passwordHash,
      role: "CUSTOMER",
      status: "ACTIVE",
    });

    // Never return the password or password hash.
    return {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  } catch (error: unknown) {
    // Handle simultaneous registration attempts for the same email.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AppError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists."
      );
    }

    throw error;
  }
}

// Validate login credentials.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(1)
    .max(128)
    .refine(
      (password) => Buffer.byteLength(password, "utf8") <= 72,
      "Invalid password length.",
    ),
});

// Authenticate a registered user.
export async function loginUser(input: unknown) {
  const data = loginSchema.parse(input);

  // Explicitly include passwordHash because the model excludes it by default.
  const user = await UserModel.findOne({
    email: data.email,
  })
    .select("+passwordHash")
    .exec();

  // Use the same error for unknown email and incorrect password.
  if (!user) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  }

  // Compare the submitted password with the stored bcrypt hash.
  const passwordMatches = await bcrypt.compare(
    data.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email or password is incorrect.",
    );
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(
      403,
      "ACCOUNT_SUSPENDED",
      "Your account is suspended.",
    );
  }

  const lastLoginAt = new Date();

  await UserModel.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt } },
  );

  // Generate a 15-minute JWT access token.
  const accessToken = await createAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  // Never return the password hash.
  return {
    user: {
      id: user._id.toString(),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt,
    },
    accessToken,
    tokenType: "Bearer" as const,
    expiresIn: 900,
  };
}