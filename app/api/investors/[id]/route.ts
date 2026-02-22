import { NextResponse } from "next/server";
import { AuditEntity } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const DeleteBodySchema = z.object({
  confirmText: z.string().trim(),
});

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede borrar inversionistas" }, { status: 403 });

    const ownerId = String(ctx.params.id || "");
    if (!ownerId) return NextResponse.json({ ok: false, error: "ownerId requerido" }, { status: 400 });

    const parsed = DeleteBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || parsed.data.confirmText.toUpperCase() !== "BORRAR") {
      return NextResponse.json({ ok: false, error: "Confirmación inválida. Debes escribir BORRAR." }, { status: 400 });
    }

    const owner = await db.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, name: true, type: true },
    });
    if (!owner) return NextResponse.json({ ok: false, error: `Owner no encontrado: ${ownerId}` }, { status: 404 });
    if (owner.type !== "INVESTOR") {
      return NextResponse.json({ ok: false, error: "Solo se permite borrar owners tipo INVESTOR" }, { status: 400 });
    }

    const lots = await db.lot.findMany({
      where: { ownerId },
      select: { id: true },
    });
    const lotIds = lots.map((l) => l.id);

    const affectedSaleLines = lotIds.length
      ? await db.saleLine.findMany({
          where: { lotId: { in: lotIds } },
          select: { id: true, saleId: true },
        })
      : [];
    const affectedSaleLineIds = affectedSaleLines.map((line) => line.id);
    const affectedSaleIds = Array.from(new Set(affectedSaleLines.map((line) => line.saleId)));

    if (affectedSaleIds.length) {
      const mixedLines = await db.saleLine.findFirst({
        where: {
          saleId: { in: affectedSaleIds },
          lotId: { notIn: lotIds },
        },
        select: { id: true, saleId: true },
      });
      if (mixedLines) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "No se puede borrar el inversionista porque tiene ventas mezcladas con otros inversionistas. " +
              "Primero separa/corrige esas ventas.",
          },
          { status: 409 },
        );
      }
    }

    const purchaseCount = await db.purchase.count({ where: { ownerId } });
    const movementCount = await db.capitalMovement.count({ where: { ownerId } });
    const ownerSplitCount = await db.profitSplit.count({ where: { ownerId } });
    const userCount = await db.user.count({ where: { ownerId } });

    await db.$transaction(async (tx) => {
      if (affectedSaleLineIds.length) {
        await tx.profitSplit.deleteMany({
          where: {
            OR: [{ ownerId }, { saleLineId: { in: affectedSaleLineIds } }],
          },
        });
        await tx.saleLine.deleteMany({
          where: { id: { in: affectedSaleLineIds } },
        });
      } else if (ownerSplitCount > 0) {
        await tx.profitSplit.deleteMany({ where: { ownerId } });
      }

      if (affectedSaleIds.length) {
        await tx.sale.deleteMany({ where: { id: { in: affectedSaleIds } } });
      }

      await tx.capitalMovement.deleteMany({ where: { ownerId } });
      await tx.purchase.deleteMany({ where: { ownerId } });
      await tx.user.deleteMany({ where: { ownerId } });
      await tx.owner.delete({ where: { id: ownerId } });

      await logAudit(
        {
          actorUserId: user.id,
          action: "owner.deleted_hard",
          entity: AuditEntity.OWNER,
          entityId: ownerId,
          payload: {
            ownerId,
            ownerName: owner.name,
            deleted: {
              purchases: purchaseCount,
              lots: lotIds.length,
              saleLines: affectedSaleLineIds.length,
              sales: affectedSaleIds.length,
              capitalMovements: movementCount,
              profitSplitsOwner: ownerSplitCount,
              users: userCount,
            },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, ownerId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
