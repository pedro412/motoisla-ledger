import { NextResponse } from "next/server";
import { AuditEntity } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidateUiPaths } from "@/lib/revalidate";

const DeleteBodySchema = z.object({
  confirmText: z.string().trim(),
  reason: z.string().trim().min(3).max(300).optional(),
});

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isStaff(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const saleId = String(ctx.params.id || "");
    if (!saleId) return NextResponse.json({ ok: false, error: "saleId requerido" }, { status: 400 });

    const parsed = DeleteBodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || parsed.data.confirmText.toUpperCase() !== "BORRAR") {
      return NextResponse.json({ ok: false, error: "Confirmación inválida. Debes escribir BORRAR." }, { status: 400 });
    }

    const sale = await db.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        date: true,
        totalGross: true,
        terminalFeeTotal: true,
        totalNetAfterFee: true,
      },
    });
    if (!sale) {
      return NextResponse.json({ ok: false, error: `Venta no encontrada: ${saleId}` }, { status: 404 });
    }

    const transferredSplits = await db.profitSplit.count({
      where: { saleId, status: "TRANSFERRED" },
    });
    if (transferredSplits > 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se puede borrar la venta porque ya tiene utilidad transferida a capital. " +
            "Primero corrige/revierte esa transferencia.",
        },
        { status: 409 },
      );
    }

    const saleLines = await db.saleLine.findMany({
      where: { saleId },
      select: {
        id: true,
        cogsGross: true,
        profitGross: true,
        lot: {
          select: {
            ownerId: true,
          },
        },
      },
    });
    const ownerIds = Array.from(new Set(saleLines.map((line) => line.lot.ownerId)));
    const totalCogs = saleLines.reduce((acc, line) => acc + toNumber(line.cogsGross), 0);
    const totalProfit = saleLines.reduce((acc, line) => acc + toNumber(line.profitGross), 0);

    await db.$transaction(async (tx) => {
      const removedCapitalMovements = await tx.capitalMovement.deleteMany({
        where: {
          type: "VENTA_COSTO",
          referenceType: "SALE",
          referenceId: saleId,
        },
      });

      const removedProfitSplits = await tx.profitSplit.deleteMany({
        where: { saleId },
      });

      const removedSaleLines = await tx.saleLine.deleteMany({
        where: { saleId },
      });

      await tx.sale.delete({
        where: { id: saleId },
      });

      await logAudit(
        {
          actorUserId: user.id,
          action: "sale.deleted_hard",
          entity: AuditEntity.SALE,
          entityId: saleId,
          payload: {
            saleId,
            ownerIds,
            reason: parsed.data.reason ?? null,
            removed: {
              saleLines: removedSaleLines.count,
              profitSplits: removedProfitSplits.count,
              capitalMovements: removedCapitalMovements.count,
            },
            totals: {
              gross: toNumber(sale.totalGross),
              terminalFee: toNumber(sale.terminalFeeTotal),
              netAfterFee: toNumber(sale.totalNetAfterFee),
              cogs: round2(totalCogs),
              profit: round2(totalProfit),
            },
            saleDate: sale.date.toISOString(),
          },
        },
        tx,
      );
    });

    revalidateUiPaths(["/dashboard", "/inventario", "/sales", "/auditoria"]);

    return NextResponse.json({
      ok: true,
      saleId,
      ownerIds,
      restored: {
        inventory: true,
        capital: true,
        profit: true,
      },
    });
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

function toNumber(value: { toString: () => string } | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}
