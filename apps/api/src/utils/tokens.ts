
import { SignJWT } from "jose";
import { env } from "../config/env.js";
import type { UserRole } from "../models/user.model.js";

const jwtSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenUser {
  id: string;
  email: string;
  role: UserRole;
}

export async function createAccessToken(
  user: AccessTokenUser,
): Promise<string> {
  const token = new SignJWT({
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({
      alg: "HS256",
      typ: "JWT",
    })
    .setIssuer("fs01-marketplace")
    .setAudience("fs01-marketplace-api")
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("15m");

  return await token.sign(jwtSecret);
}
