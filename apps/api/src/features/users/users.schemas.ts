import { z } from "zod";

import type { User } from "../../generated/prisma/client.js";

// Public shape of a User — what the API exposes. `passwordHash` never
// leaves the service layer.
export const userPublicSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  defaultCurrency: z.string().length(3),
  timezone: z.string(),
  weekStartsOn: z.number().int().min(0).max(6),
  createdAt: z.date(),
});

export type UserPublic = z.infer<typeof userPublicSchema>;

export const toUserPublic = (user: User): UserPublic => ({
  id: user.id,
  email: user.email,
  defaultCurrency: user.defaultCurrency,
  timezone: user.timezone,
  weekStartsOn: user.weekStartsOn,
  createdAt: user.createdAt,
});
