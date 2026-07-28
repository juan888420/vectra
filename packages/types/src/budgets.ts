import { z } from "zod";

// Hand-mirrored from apps/api/src/features/budgets/budgets.schemas.ts.
// `archivedAt`/`createdAt`/`updatedAt` are strings, not the backend's own
// `z.date()`, for the same reason as auth.ts (JSON never produces Dates).
//
// Deliberately partial: only `budgetPublicSchema` is mirrored here, since the
// dashboard (RFC-0020) only ever reads budgets, it never creates/updates one.
// A future Budgets CRUD UI should extend this same file with
// create/update/list-query schemas rather than adding a competing file.

export const budgetPeriodSchema = z.enum(["MONTHLY"]);

export type BudgetPeriod = z.infer<typeof budgetPeriodSchema>;

export const budgetStatusSchema = z.enum(["ON_TRACK", "WARNING", "EXCEEDED"]);

export type BudgetStatus = z.infer<typeof budgetStatusSchema>;

export const budgetPublicSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  amount: z.number(),
  currency: z.string().length(3),
  period: budgetPeriodSchema,
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  spent: z.number(),
  remaining: z.number(),
  percentUsed: z.number(),
  status: budgetStatusSchema,
});

export type BudgetPublic = z.infer<typeof budgetPublicSchema>;
