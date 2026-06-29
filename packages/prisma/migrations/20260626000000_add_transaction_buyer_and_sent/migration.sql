-- AlterTable: capture buyer details on the loop and track the signing send.
ALTER TABLE "Transaction" ADD COLUMN "buyerName" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "buyerEmail" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "sentDocumentId" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "sentAt" TIMESTAMP(3);
