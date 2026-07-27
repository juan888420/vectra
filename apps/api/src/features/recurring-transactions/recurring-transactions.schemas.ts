import { z } from "zod";

import {
  paginatedResponseSchema,
  paginationQuerySchema,
  queryBooleanSchema,
  sortQuerySchema,
} from "../../lib/pagination.js";
import { moneyAmountSchema } from "../../lib/schemas.js";

export const recurrenceFrequencySchema = z.enum([
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "YEARLY",
]);

// `type` is not stored on the template: it derives from the category
// (business rule 2), exactly as the Prisma model documents.
export const recurringTransactionPublicSchema = z.object({
  id: z.uuid(),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  amount: z.number(),
  currency: z.string().length(3),
  frequency: recurrenceFrequencySchema,
  startDate: z.date(),
  endDate: z.date().nullable(),
  nextExecutionDate: z.date(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// `currency` derives from the account and `nextExecutionDate` is
// system-managed (seeded to `startDate`), so neither is accepted here.
export const createRecurringTransactionBodySchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    amount: moneyAmountSchema,
    frequency: recurrenceFrequencySchema,
    startDate: z.iso.date(),
    endDate: z.iso.date().nullish(),
  })
  .refine((body) => !body.endDate || body.endDate >= body.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

// `startDate` is immutable: it is the schedule's anchor, so changing it would
// retroactively redefine every occurrence already generated. Frequency changes
// apply from the next execution onward (business rule 5 in spirit: generated
// transactions stay independent of later template edits).
export const updateRecurringTransactionBodySchema = z
  .object({
    accountId: z.uuid(),
    categoryId: z.uuid(),
    amount: moneyAmountSchema,
    frequency: recurrenceFrequencySchema,
    endDate: z.iso.date().nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const listRecurringTransactionsQuerySchema = paginationQuerySchema
  .extend(
    sortQuerySchema(["nextExecutionDate", "startDate", "amount", "createdAt"], "nextExecutionDate")
      .shape,
  )
  .extend({
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    frequency: recurrenceFrequencySchema.optional(),
    includeInactive: queryBooleanSchema,
  });

export const recurringTransactionListResponseSchema = paginatedResponseSchema(
  recurringTransactionPublicSchema,
);

export type CreateRecurringTransactionBody = z.infer<typeof createRecurringTransactionBodySchema>;
export type UpdateRecurringTransactionBody = z.infer<typeof updateRecurringTransactionBodySchema>;
export type ListRecurringTransactionsQuery = z.infer<typeof listRecurringTransactionsQuerySchema>;
