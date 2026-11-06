import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { env } from "../config/env.js";
import { UserModel } from "../models/user.model.js";

async function createAdmin() {
  const firstName = process.env.ADMIN_FIRST_NAME?.trim();
  const lastName = process.env.ADMIN_LAST_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!firstName || !lastName || !email || !password) {
    throw new Error("Missing admin details in environment variables.");
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Admin password must be 12–128 characters long.");
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Admin password exceeds the bcrypt 72-byte limit.");
  }

  await mongoose.connect(env.MONGODB_URI);

  const existingUser = await UserModel.findOne({ email });

  if (existingUser) {
    throw new Error(
      "An account with this email already exists. Choose a new admin email.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await UserModel.create({
    firstName,
    lastName,
    email,
    passwordHash,
    role: "ADMIN",
    status: "ACTIVE",
  });

  console.log("ADMIN account created successfully.");
  console.log(`Admin email: ${admin.email}`);
  console.log(`Admin role: ${admin.role}`);
}

createAdmin()
  .catch((error) => {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });