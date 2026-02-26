-- Ensure production enum is aligned with current Prisma schema.
ALTER TYPE "CapitalMovementType" ADD VALUE IF NOT EXISTS 'APORTE_CAPITAL';
ALTER TYPE "CapitalMovementType" ADD VALUE IF NOT EXISTS 'RETIRO_CAPITAL';
