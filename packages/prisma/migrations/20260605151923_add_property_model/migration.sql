-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "mlsNumber" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'DE',
    "beds" INTEGER,
    "baths" TEXT,
    "structureType" TEXT,
    "contractDate" TIMESTAMP(3),
    "listOfficeName" TEXT,
    "price" INTEGER,
    "sourceSheet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Property_mlsNumber_key" ON "Property"("mlsNumber");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_mlsNumber_idx" ON "Property"("mlsNumber");
