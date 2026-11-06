import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { env } from "../config/env.js";
import { UserModel } from "../models/user.model.js";

async function resetCustomerPassword() {
  const email = process.env.CUSTOMER_EMAIL?.trim().toLowerCase();
  const password = process.env.CUSTOMER_PASSWORD;

  if (!email || !password) {
    throw new Error("Customer email or password is missing.");
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must contain 12–128 characters.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Password exceeds the bcrypt 72-byte limit.");
  }

  await mongoose.connect(env.MONGODB_URI);

  const user = await UserModel.findOne({ email });

  if (!user) {
    throw new Error("Customer account not found.");
  }

  if (user.role !== "CUSTOMER") {
    throw new Error("This account is not a CUSTOMER account.");
  }

  user.passwordHash = await bcrypt.hash(password, 12);

  await user.save();

  console.log("Customer password reset successfully.");
  console.log(`Customer email: ${user.email}`);
  console.log(`Customer role: ${user.role}`);
}

resetCustomerPassword()
  .catch((error) => {
    console.error("Password reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });