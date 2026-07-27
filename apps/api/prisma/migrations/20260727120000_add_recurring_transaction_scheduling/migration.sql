-- AlterEnum: DAILY and BIWEEKLY complete the frequency set (RFC-0015).
-- Safe inside a transaction on PostgreSQL 12+ as long as the new values are
-- not used by later statements in this same migration — they are not.
ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "RecurrenceFrequency" ADD VALUE IF NOT EXISTS 'BIWEEKLY';

-- AlterTable: system-managed pointer to the next occurrence to generate.
-- Added nullable, backfilled from startDate, then made NOT NULL so existing
-- rows keep a valid schedule.
ALTER TABLE "recurring_transactions" ADD COLUMN "nextExecutionDate" DATE;
UPDATE "recurring_transactions" SET "nextExecutionDate" = "startDate" WHERE "nextExecutionDate" IS NULL;
ALTER TABLE "recurring_transactions" ALTER COLUMN "nextExecutionDate" SET NOT NULL;

-- CreateIndex: idempotency guard for the processor. A given template can hold
-- at most one transaction per date, so a double run (or two schedulers racing)
-- cannot duplicate an occurrence. Manual transactions have a NULL
-- recurringTransactionId and Postgres treats NULLs as distinct, so they are
-- unaffected.
CREATE UNIQUE INDEX "transactions_recurringTransactionId_date_key" ON "transactions"("recurringTransactionId", "date");

-- CreateIndex: the processor's hot path — active templates that are due.
CREATE INDEX "recurring_transactions_isActive_nextExecutionDate_idx" ON "recurring_transactions"("isActive", "nextExecutionDate");
