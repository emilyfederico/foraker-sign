-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "userId" INTEGER;

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- Backfill: assign all pre-existing loops to the owner account.
-- (email is filled in before deploy)
UPDATE "Transaction"
SET "userId" = (SELECT "id" FROM "User" WHERE lower("email") = lower('Brian@forakersales.com'))
WHERE "userId" IS NULL;
