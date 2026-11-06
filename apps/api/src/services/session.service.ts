
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { redis } from "../infrastructure/redis.js";
import { AppError } from "../middleware/app-error.js";

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;
const ABSOLUTE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SESSION_PREFIX = "auth:session:";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRandomToken(): string {
  return randomBytes(32).toString("base64url");
}

function parseRefreshToken(token: string): {
  sessionId: string;
  secret: string;
} {
  const separator = token.indexOf(".");

  if (separator <= 0 || separator === token.length - 1) {
    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid or expired.",
    );
  }

  const sessionId = token.slice(0, separator);
  const secret = token.slice(separator + 1);

  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[A-Za-z0-9_-]{43}$/.test(secret)) {
    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid or expired.",
    );
  }

  return { sessionId, secret };
}

// Create a new server-side refresh session.
export async function createRefreshSession(userId: string) {
  const sessionId = randomUUID();
  const secret = createRandomToken();
  const tokenHash = hashToken(secret);

  const absoluteExpiresAt = Date.now() + ABSOLUTE_SESSION_TTL_MS;
  const redisKey = `${SESSION_PREFIX}${sessionId}`;

  await redis
    .multi()
    .hSet(redisKey, {
      userId,
      tokenHash,
      absoluteExpiresAt: String(absoluteExpiresAt),
    })
    .expire(redisKey, REFRESH_TTL_SECONDS)
    .exec();

  return {
    refreshToken: `${sessionId}.${secret}`,
    sessionId,
  };
}

// Atomically rotate a refresh token.
// Reuse of an already-rotated token revokes that session.
const ROTATE_SESSION_SCRIPT = `
local userId = redis.call("HGET", KEYS[1], "userId")

if not userId then
  return 0
end

local storedHash = redis.call("HGET", KEYS[1], "tokenHash")

if storedHash ~= ARGV[1] then
  redis.call("DEL", KEYS[1])
  return -1
end

local absoluteExpiry = tonumber(
  redis.call("HGET", KEYS[1], "absoluteExpiresAt")
)

local now = tonumber(ARGV[3])

if not absoluteExpiry or absoluteExpiry <= now then
  redis.call("DEL", KEYS[1])
  return 0
end

local remainingSeconds = math.ceil(
  (absoluteExpiry - now) / 1000
)

local ttl = math.min(
  tonumber(ARGV[4]),
  remainingSeconds
)

redis.call("HSET", KEYS[1], "tokenHash", ARGV[2])
redis.call("EXPIRE", KEYS[1], ttl)

return userId
`;

export async function rotateRefreshSession(token: string) {
  const { sessionId, secret } = parseRefreshToken(token);

  const newSecret = createRandomToken();
  const redisKey = `${SESSION_PREFIX}${sessionId}`;

  const result = await redis.eval(ROTATE_SESSION_SCRIPT, {
    keys: [redisKey],
    arguments: [
      hashToken(secret),
      hashToken(newSecret),
      String(Date.now()),
      String(REFRESH_TTL_SECONDS),
    ],
  });

  if (typeof result !== "string") {
    throw new AppError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid, expired, or has already been used.",
    );
  }

  return {
    userId: result,
    refreshToken: `${sessionId}.${newSecret}`,
  };
}

// Revoke a refresh session during logout.
export async function revokeRefreshSession(token: string | undefined) {
  if (!token) return;

  const { sessionId } = parseRefreshToken(token);

  await redis.del(`${SESSION_PREFIX}${sessionId}`);
}
