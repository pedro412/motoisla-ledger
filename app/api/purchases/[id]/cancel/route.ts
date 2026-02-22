import { NextResponse } from "next/server";
import { AuditEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { uid } from "@/lib/ids";
import { revalidateUiPaths } from "@/lib/revalidate";

const BodySchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isStaff(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const purchaseId = String(ctx.params.id || "");
    if (!purchaseId) return NextResponse.json({ ok: false, error: "purchaseId requerido" }, { status: 400 });

    const body = BodySchema.parse(await req.json().catch(() => ({})));

    const purchase = await db.purchase.findUnique({
      where: { id: purchaseId },
      select: {
        id: true,
        ownerId: true,
        totalGross: true,
        date: true,
        status: true,
      },
    });
    if (!purchase) {
      return NextResponse.json({ ok: false, error: `Compra no encontrada: ${purchaseId}` }, { status: 404 });
    }
    if (purchase.status === "CANCELLED") {
      return NextResponse.json({ ok: false, error: `La compra ${purchaseId} ya está cancelada` }, { status: 400 });
    }

    const lotRows = await db.lot.findMany({
      where: { purchaseId },
      select: { id: true },
    });
    const lotIds = lotRows.map((l) => l.id);
    const soldCount = lotIds.length
      ? await db.saleLine.count({
          where: { lotId: { in: lotIds } },
        })
      : 0;

    if (soldCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se puede cancelar la compra porque ya tiene ventas registradas en sus lotes.",
        },
        { status: 409 },
      );
    }

    await db.$transaction(async (tx) => {
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledByUserId: user.id,
          cancelReason: body.reason,
          updatedByUserId: user.id,
        },
      });

      await tx.lot.updateMany({
        where: { purchaseId },
        data: { status: "CANCELLED" },
      });

      await tx.capitalMovement.create({
        data: {
          id: uid("cap"),
          ownerId: purchase.ownerId,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          type: "REVERSA_COMPRA",
          amount: dec(toNumber(purchase.totalGross)),
          referenceType: "PURCHASE",
          referenceId: purchaseId,
          date: new Date(),
          notes: `Cancelación de compra: ${body.reason}`,
        },
      });

      await logAudit(
        {
          actorUserId: user.id,
          action: "purchase.cancelled",
          entity: AuditEntity.PURCHASE,
          entityId: purchaseId,
          payload: {
            ownerId: purchase.ownerId,
            totalGross: toNumber(purchase.totalGross),
            reason: body.reason,
          },
        },
        tx,
      );
    });

    revalidateUiPaths(["/dashboard", "/inventario", "/auditoria"]);

    return NextResponse.json({ ok: true, purchaseId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number) {
  return new Prisma.Decimal(round2(n));
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}
