import { AuditEntity, Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type AuditWriter = Pick<PrismaClient, "auditLog"> | Pick<Prisma.TransactionClient, "auditLog">;

type LogAuditParams = {
  actorUserId?: string | null;
  action: string;
  entity: AuditEntity;
  entityId: string;
  payload?: Prisma.InputJsonValue;
};

export async function logAudit(params: LogAuditParams, writer: AuditWriter = db) {
  await writer.auditLog.create({
    data: {
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      payload: params.payload,
    },
  });
}
