-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('INVESTOR', 'MOTOISLA');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERADOR', 'INVERSIONISTA');

-- CreateEnum
CREATE TYPE "CapitalMovementType" AS ENUM ('CAPITAL_INICIAL', 'AJUSTE_CAPITAL_INICIAL', 'APORTE_CAPITAL', 'RETIRO_CAPITAL', 'COMPRA', 'REVERSA_COMPRA', 'VENTA_COSTO', 'UTILIDAD_A_CAPITAL');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProfitSplitStatus" AS ENUM ('ACCRUED', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('OWNER', 'PURCHASE', 'SALE', 'CAPITAL_MOVEMENT', 'PROFIT_SPLIT', 'LOT');

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OwnerType" NOT NULL,
    "initialCapital" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalMovement" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "type" "CapitalMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CapitalMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancelReason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT NOT NULL,
    "invoiceRef" TEXT NOT NULL,
    "subtotalNet" DECIMAL(14,2) NOT NULL,
    "taxTotal" DECIMAL(14,2) NOT NULL,
    "totalGross" DECIMAL(14,2) NOT NULL,
    "taxRate" DECIMAL(8,6) NOT NULL,
    "rawDocText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "supplierSku" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "descriptionRaw" TEXT NOT NULL,
    "qty" DECIMAL(14,6) NOT NULL,
    "lineTotalNet" DECIMAL(14,2) NOT NULL,
    "satProductKey" TEXT,
    "pedimento" TEXT,
    "lineTaxAllocated" DECIMAL(14,2) NOT NULL,
    "lineTotalGross" DECIMAL(14,2) NOT NULL,
    "unitCostNetExact" DECIMAL(14,6) NOT NULL,
    "unitCostGrossExact" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "purchaseLineId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'ACTIVE',
    "supplierSku" TEXT NOT NULL,
    "internalSku" TEXT,
    "description" TEXT NOT NULL,
    "qtyBought" DECIMAL(14,6) NOT NULL,
    "unitCostGross" DECIMAL(14,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "notes" TEXT,
    "terminalPayment" BOOLEAN NOT NULL DEFAULT false,
    "threeMonthsNoInterest" BOOLEAN NOT NULL DEFAULT false,
    "commissionRate" DECIMAL(8,6) NOT NULL,
    "totalGross" DECIMAL(14,2) NOT NULL,
    "terminalFeeTotal" DECIMAL(14,2) NOT NULL,
    "totalNetAfterFee" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "qty" DECIMAL(14,6) NOT NULL,
    "unitPriceGross" DECIMAL(14,2) NOT NULL,
    "discountGross" DECIMAL(14,2) NOT NULL,
    "grossRevenue" DECIMAL(14,2) NOT NULL,
    "terminalFee" DECIMAL(14,2) NOT NULL,
    "netRevenue" DECIMAL(14,2) NOT NULL,
    "cogsGross" DECIMAL(14,2) NOT NULL,
    "profitGross" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitSplit" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "saleLineId" TEXT,
    "ownerId" TEXT NOT NULL,
    "profitShareGross" DECIMAL(14,2) NOT NULL,
    "status" "ProfitSplitStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERADOR',
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapitalMovement_ownerId_date_idx" ON "CapitalMovement"("ownerId", "date");

-- CreateIndex
CREATE INDEX "CapitalMovement_referenceType_referenceId_idx" ON "CapitalMovement"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "Purchase_ownerId_date_idx" ON "Purchase"("ownerId", "date");

-- CreateIndex
CREATE INDEX "PurchaseLine_supplierSku_idx" ON "PurchaseLine"("supplierSku");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_purchaseId_lineNo_key" ON "PurchaseLine"("purchaseId", "lineNo");

-- CreateIndex
CREATE INDEX "Lot_ownerId_idx" ON "Lot"("ownerId");

-- CreateIndex
CREATE INDEX "Lot_purchaseId_idx" ON "Lot"("purchaseId");

-- CreateIndex
CREATE INDEX "Sale_date_idx" ON "Sale"("date");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_lotId_idx" ON "SaleLine"("lotId");

-- CreateIndex
CREATE INDEX "ProfitSplit_saleId_idx" ON "ProfitSplit"("saleId");

-- CreateIndex
CREATE INDEX "ProfitSplit_ownerId_idx" ON "ProfitSplit"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "CapitalMovement" ADD CONSTRAINT "CapitalMovement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_purchaseLineId_fkey" FOREIGN KEY ("purchaseLineId") REFERENCES "PurchaseLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitSplit" ADD CONSTRAINT "ProfitSplit_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitSplit" ADD CONSTRAINT "ProfitSplit_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitSplit" ADD CONSTRAINT "ProfitSplit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

