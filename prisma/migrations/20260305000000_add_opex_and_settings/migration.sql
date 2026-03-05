-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'SETTING';

-- AlterTable
ALTER TABLE "ProfitSplit" ADD COLUMN "opexDeduction" DECIMAL(14,2),
ADD COLUMN "opexRate" DECIMAL(8,6);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);
