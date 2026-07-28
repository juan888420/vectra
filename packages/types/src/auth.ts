import { z } from "zod";

// Hand-mirrored from apps/api/src/features/auth/auth.schemas.ts and
// apps/api/src/features/users/users.schemas.ts. Kept in sync by hand, same
// discipline the backend itself uses to mirror Prisma -> Zod.
//
// `createdAt` deliberately differs from the backend's own `z.date()`: the
// backend schema validates a real Date object server-side, but the value
// that actually crosses the wire is a JSON string (JSON.parse never
// produces Date instances) — so the frontend mirror parses it as a string.

export const userPublicSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  defaultCurrency: z.string().length(3),
  timezone: z.string(),
  weekStartsOn: z.number().int().min(0).max(6),
  createdAt: z.string(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

export const registerBodySchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8).max(72),
  defaultCurrency: z
    .string()
    .length(3)
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 code")
    .default("COP"),
  timezone: z.string().default("UTC"),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

export const authResponseSchema = z.object({
  user: userPublicSchema,
  accessToken: z.string(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
