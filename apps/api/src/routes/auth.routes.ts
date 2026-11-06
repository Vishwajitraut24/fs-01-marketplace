
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  registerCustomer,
  loginUser,
} from "../services/auth.service.js";

import {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
} from "../services/session.service.js";

import { createAccessToken } from "../utils/tokens.js";
import { UserModel } from "../models/user.model.js";
import { AppError } from "../middleware/app-error.js";
import { env } from "../config/env.js";

export const authRouter = Router();

const REFRESH_COOKIE = "fs01_refresh";

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
};

// Customer registration
authRouter.post("/register", async (request, response) => {
  const user = await registerCustomer(request.body);

  response.status(201).json({
    success: true,
    message: "Customer account created successfully.",
    data: { user },
  });
});

// Customer login
authRouter.post("/login", async (request, response) => {
  const result = await loginUser(request.body);

  // Create a server-side refresh session in Redis.
  const session = await createRefreshSession(result.user.id);

  // Store the refresh token in an HTTP-only cookie.
  response.cookie(
    REFRESH_COOKIE,
    session.refreshToken,
    refreshCookieOptions,
  );

  response.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
    },
  });
});

// Refresh access token and rotate refresh token.
authRouter.post("/refresh", async (request, response) => {
  const oldRefreshToken = request.cookies?.[REFRESH_COOKIE];

  if (typeof oldRefreshToken !== "string" || !oldRefreshToken) {
    response.clearCookie(REFRESH_COOKIE, clearCookieOptions);

    throw new AppError(
      401,
      "REFRESH_TOKEN_MISSING",
      "Please log in again.",
    );
  }

  let rotated: Awaited<ReturnType<typeof rotateRefreshSession>>;

  try {
    rotated = await rotateRefreshSession(oldRefreshToken);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) {
      response.clearCookie(REFRESH_COOKIE, clearCookieOptions);
    }

    throw error;
  }

  const user = await UserModel.findById(rotated.userId)
    .select("firstName lastName email role status")
    .exec();

  if (!user || user.status !== "ACTIVE") {
    await revokeRefreshSession(rotated.refreshToken);
    response.clearCookie(REFRESH_COOKIE, clearCookieOptions);

    throw new AppError(
      401,
      "INVALID_REFRESH_SESSION",
      "Your session is no longer valid. Please log in again.",
    );
  }

  const accessToken = await createAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  // Replace the old cookie with the newly rotated token.
  response.cookie(
    REFRESH_COOKIE,
    rotated.refreshToken,
    refreshCookieOptions,
  );

  response.status(200).json({
    success: true,
    message: "Session refreshed successfully.",
    data: {
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
      },
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900,
    },
  });
});

// Logout and revoke the current refresh session.
authRouter.post("/logout", async (request, response) => {
  const refreshToken = request.cookies?.[REFRESH_COOKIE];

  if (typeof refreshToken === "string" && refreshToken) {
    try {
      await revokeRefreshSession(refreshToken);
    } catch (error) {
      // An already-invalid token is harmless during logout.
      if (!(error instanceof AppError) || error.statusCode !== 401) {
        throw error;
      }
    }
  }

  response.clearCookie(REFRESH_COOKIE, clearCookieOptions);

  response.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
});

// GET /api/v1/auth/me
// Returns the currently authenticated user.
authRouter.get("/me", authenticate, (request, response) => {
  const user = request.auth;

  if (!user) {
    response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
    return;
  }

  response.status(200).json({
    success: true,
    message: "Authenticated user retrieved successfully.",
    data: {
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
      },
    },
  });
});
