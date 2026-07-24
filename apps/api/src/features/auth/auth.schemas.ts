import { z } from "zod";

import { userPublicSchema } from "../users/users.schemas.js";

export const registerBodySchema = z.object({
  email: z.email().toLowerCase(),
  // bcrypt truncates input at 72 bytes, so longer passwords are rejected.
  password: z.string().min(8).max(72),
  defaultCurrency: z
    .string()
    .length(3)
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Must be an ISO 4217 code")
    .default("USD"),
  timezone: z.string().default("UTC"),
});

export const loginBodySchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

// Refresh token travels in an HttpOnly cookie, never in the body.
export const authResponseSchema = z.object({
  user: userPublicSchema,
  accessToken: z.string(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
