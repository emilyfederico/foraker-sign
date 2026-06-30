-- AlterTable: store the loop's people (clients, vendors, co-agents) as JSON.
ALTER TABLE "Transaction" ADD COLUMN "people" JSONB;
