import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcrypt";

import { conflict, unauthorized } from "../../lib/http-errors.js";
import { Prisma, type PrismaClient, type User } from "../../generated/prisma/client.js";
import { createInitialUserData } from "./initial-user-data.js";
import type { RegisterBody } from "./auth.schemas.js";

const BCRYPT_COST = 12;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// The refresh token is opaque (256 random bits); only its SHA-256 hash is
// stored, so a leaked DB cannot be replayed as a session.
const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

interface IssuedRefreshToken {
  id: string;
  token: string;
  expiresAt: Date;
}

async function issueRefreshToken(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const { id } = await tx.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return { id, token, expiresAt };
}

export async function registerUser(
  prisma: PrismaClient,
  input: RegisterBody,
): Promise<{ user: User; refreshToken: IssuedRefreshToken }> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          defaultCurrency: input.defaultCurrency,
          timezone: input.timezone,
        },
      });

      await createInitialUserData(tx, user.id);
      const refreshToken = await issueRefreshToken(tx, user.id);

      return { user, refreshToken };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("EMAIL_TAKEN", "Email is already registered");
    }
    throw error;
  }
}

export async function loginUser(
  prisma: PrismaClient,
  email: string,
  password: string,
): Promise<{ user: User; refreshToken: IssuedRefreshToken }> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for unknown email and wrong password: no account enumeration.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw unauthorized("INVALID_CREDENTIALS", "Invalid email or password");
  }

  const refreshToken = await issueRefreshToken(prisma, user.id);
  return { user, refreshToken };
}

// How long a just-rotated token is still accepted. Two tabs restoring the
// session at once, a reload racing a background refresh, or a retried request
// all present the same cookie twice within moments; without this window the
// second one would read as token theft and log the user out everywhere.
export const REFRESH_REUSE_GRACE_MS = 30_000;

// `refreshToken: null` means "session confirmed, keep the cookie you have":
// a concurrent request already rotated it, and its Set-Cookie carries the
// successor. Issuing another one here would fork the session.
export interface RefreshResult {
  user: User;
  refreshToken: IssuedRefreshToken | null;
}

type StoredRefreshToken = Prisma.RefreshTokenGetPayload<{
  include: { user: true; replacedBy: true };
}>;

// Thrown inside the rotation transaction to roll back the successor it
// created when a concurrent request rotated the same token first.
class RotationRaceLost extends Error {}

async function revokeAllSessions(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function resolveRevokedToken(
  prisma: PrismaClient,
  stored: StoredRefreshToken & { revokedAt: Date },
): Promise<RefreshResult> {
  // No successor: logged out, or already killed by reuse detection. Dead,
  // but not evidence of theft — other sessions are left alone.
  if (!stored.replacedBy) {
    throw unauthorized("UNAUTHENTICATED", "Refresh token revoked");
  }

  const withinGrace = Date.now() - stored.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
  if (!withinGrace) {
    // A rotated token coming back later means it was copied: either the
    // legitimate client or an attacker holds a stale value. Kill every
    // session for this user so the stolen one dies too.
    await revokeAllSessions(prisma, stored.userId);
    throw unauthorized("UNAUTHENTICATED", "Refresh token reuse detected");
  }

  // Within the window, only if the session it rotated into is still alive
  // (active, or itself rotated onward) — never revive a logged-out session.
  const { replacedBy } = stored;
  const sessionAlive = replacedBy.revokedAt === null || replacedBy.replacedById !== null;
  if (!sessionAlive) {
    throw unauthorized("UNAUTHENTICATED", "Refresh token revoked");
  }

  return { user: stored.user, refreshToken: null };
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  token: string,
): Promise<RefreshResult> {
  const include = { user: true, replacedBy: true } as const;
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include,
  });

  if (!stored) {
    throw unauthorized("UNAUTHENTICATED", "Invalid refresh token");
  }
  if (stored.revokedAt) {
    return resolveRevokedToken(prisma, { ...stored, revokedAt: stored.revokedAt });
  }
  if (stored.expiresAt < new Date()) {
    throw unauthorized("UNAUTHENTICATED", "Refresh token expired");
  }

  try {
    const refreshToken = await prisma.$transaction(async (tx) => {
      const successor = await issueRefreshToken(tx, stored.userId);
      // Conditional on still being active: of two concurrent rotations, the
      // second blocks on this row and then matches nothing, instead of both
      // minting a successor from the same token.
      const { count } = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: successor.id },
      });
      if (count === 0) {
        throw new RotationRaceLost();
      }
      return successor;
    });
    return { user: stored.user, refreshToken };
  } catch (error) {
    if (!(error instanceof RotationRaceLost)) {
      throw error;
    }
    const current = await prisma.refreshToken.findUniqueOrThrow({
      where: { id: stored.id },
      include,
    });
    if (!current.revokedAt) {
      throw error;
    }
    return resolveRevokedToken(prisma, { ...current, revokedAt: current.revokedAt });
  }
}

export async function revokeRefreshToken(prisma: PrismaClient, token: string): Promise<void> {
  // Idempotent: logging out with an unknown/expired token is not an error.
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(prisma: PrismaClient, id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    // Valid JWT for a deleted user — treat as an expired session.
    throw unauthorized("UNAUTHENTICATED", "User no longer exists");
  }
  return user;
}
