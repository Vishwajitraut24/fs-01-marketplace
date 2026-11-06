
import type { RequestHandler } from "express";
import { jwtVerify } from "jose";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";
import { UserModel } from "../models/user.model.js";
import type { UserRole } from "../models/user.model.js";

const jwtSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}

// Add authenticated-user information to Express requests.
declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

// Verify the access token and load the current user.
export const authenticate: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(
      new AppError(
        401,
        "UNAUTHORIZED",
        "A valid access token is required.",
      ),
    );
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return next(
      new AppError(401, "UNAUTHORIZED", "Access token is missing."),
    );
  }

  let userId: string;

  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: "fs01-marketplace",
      audience: "fs01-marketplace-api",
    });

    if (!payload.sub) {
      return next(
        new AppError(401, "INVALID_TOKEN", "Invalid access token."),
      );
    }

    userId = payload.sub;
  } catch {
    return next(
      new AppError(
        401,
        "INVALID_TOKEN",
        "Access token is invalid or expired.",
      ),
    );
  }

  // Always use the database as the source of truth for roles and status.
  const user = await UserModel.findById(userId)
    .select("email role status")
    .exec();

  if (!user) {
    return next(
      new AppError(401, "USER_NOT_FOUND", "User account is unavailable."),
    );
  }

  if (user.status !== "ACTIVE") {
    return next(
      new AppError(403, "ACCOUNT_SUSPENDED", "Your account is suspended."),
    );
  }

  request.auth = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  };

  next();
};

// Restrict endpoints to specific roles.
export function requireRoles(...allowedRoles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      return next(
        new AppError(401, "UNAUTHORIZED", "Authentication is required."),
      );
    }

    if (!allowedRoles.includes(request.auth.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to access this resource.",
        ),
      );
    }

    next();
  };
}
