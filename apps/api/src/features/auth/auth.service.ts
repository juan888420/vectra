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
  token: string;
  expiresAt: Date;
}

async function issueRefreshToken(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<IssuedRefreshToken> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await tx.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return { token, expiresAt };
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

      await createInitialUserData(tx, user.id, user.defaultCurrency);
      const refreshToken = await issueRefreshToken(tx, user.id);

      return { user, refreshToken };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw conflict("Email is already registered");
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
    throw unauthorized("Invalid email or password");
  }

  const refreshToken = await issueRefreshToken(prisma, user.id);
  return { user, refreshToken };
}

export async function rotateRefreshToken(
  prisma: PrismaClient,
  token: string,
): Promise<{ user: User; refreshToken: IssuedRefreshToken }> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!stored) {
    throw unauthorized("Invalid refresh token");
  }

  // A revoked token coming back means it was already rotated once: either a
  // replayed request or a stolen token. Kill every session for this user.
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw unauthorized("Refresh token reuse detected");
  }

  if (stored.expiresAt < new Date()) {
    throw unauthorized("Refresh token expired");
  }

  const refreshToken = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return issueRefreshToken(tx, stored.userId);
  });

  return { user: stored.user, refreshToken };
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
    throw unauthorized("User no longer exists");
  }
  return user;
}
