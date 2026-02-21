import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { uid } from "@/lib/ids";
import { db } from "@/lib/db";
import { resolveProfitOwners } from "@/lib/capital";
import { SaleCreateSchema } from "@/types/schemas";

export async function POST(req: Request) {
  try {
    const body = SaleCreateSchema.parse(await req.json());

    const saleId = uid("sale");
    const createdAt = new Date().toISOString();
    const { motoIslaOwnerId } = await resolveProfitOwners();

    const requestedByLot = new Map<string, number>();
    for (const line of body.lines) {
      requestedByLot.set(line.lotId, (requestedByLot.get(line.lotId) ?? 0) + line.qty);
    }

    const lotIds = Array.from(requestedByLot.keys());
    const [lots, soldRows] = await Promise.all([
      db.lot.findMany({
        where: { id: { in: lotIds } },
        select: { id: true, ownerId: true, unitCostGross: true, supplierSku: true, qtyBought: true },
      }),
      db.saleLine.groupBy({
        by: ["lotId"],
        where: { lotId: { in: lotIds } },
        _sum: { qty: true },
      }),
    ]);

    const lotMap = new Map(lots.map((l) => [l.id, l]));
    const soldByLot = new Map(soldRows.map((r) => [r.lotId, toNumber(r._sum.qty)]));

    for (const [lotId, requestedQty] of requestedByLot.entries()) {
      const lot = lotMap.get(lotId);
      if (!lot) {
        throw new Error(`Lot not found: ${lotId}`);
      }
      const availableQty = toNumber(lot.qtyBought) - (soldByLot.get(lotId) ?? 0);
      if (requestedQty > availableQty) {
        throw new Error(
          `Cantidad excedida para lote ${lotId}: solicitado=${round6(requestedQty)} disponible=${round6(availableQty)}`
        );
      }
    }

    const commissionRate = getCommissionRate(body.terminalPayment, body.threeMonthsNoInterest);
    const computedLines = body.lines.map((line) => {
      const lot = lotMap.get(line.lotId);
      if (!lot) {
        throw new Error(`Lot not found: ${line.lotId}`);
      }

      const grossRevenue = round2(line.qty * line.unitPriceGross - line.discountGross);
      const terminalFee = round2(grossRevenue * commissionRate);
      const netRevenue = round2(grossRevenue - terminalFee);
      const cogs = round2(line.qty * toNumber(lot.unitCostGross));
      const profit = round2(netRevenue - cogs);

      return {
        ...line,
        ownerId: lot.ownerId,
        resolvedSku: line.sku || lot.supplierSku,
        grossRevenue,
        terminalFee,
        netRevenue,
        cogs,
        profit,
      };
    });

    const totalGross = computedLines.reduce((acc, line) => acc + line.grossRevenue, 0);
    const totalTerminalFee = computedLines.reduce((acc, line) => acc + line.terminalFee, 0);
    const totalNetAfterFee = computedLines.reduce((acc, line) => acc + line.netRevenue, 0);

    await db.$transaction(async (tx) => {
      await tx.sale.create({
        data: {
          id: saleId,
          date: new Date(body.date),
          channel: body.channel,
          notes: body.notes ?? "",
          terminalPayment: body.terminalPayment,
          threeMonthsNoInterest: body.threeMonthsNoInterest,
          commissionRate: dec6(commissionRate),
          totalGross: dec(totalGross),
          terminalFeeTotal: dec(totalTerminalFee),
          totalNetAfterFee: dec(totalNetAfterFee),
          createdAt: new Date(createdAt),
          updatedAt: new Date(createdAt),
        },
      });

      const cogsByOwner = new Map<string, number>();

      for (const cl of computedLines) {
        cogsByOwner.set(cl.ownerId, (cogsByOwner.get(cl.ownerId) ?? 0) + cl.cogs);

        const saleLineId = uid("sl");
        await tx.saleLine.create({
          data: {
            id: saleLineId,
            saleId,
            lotId: cl.lotId,
            sku: cl.resolvedSku,
            qty: dec6(cl.qty),
            unitPriceGross: dec(cl.unitPriceGross),
            discountGross: dec(cl.discountGross),
            grossRevenue: dec(cl.grossRevenue),
            terminalFee: dec(cl.terminalFee),
            netRevenue: dec(cl.netRevenue),
            cogsGross: dec(cl.cogs),
            profitGross: dec(cl.profit),
            createdAt: new Date(createdAt),
          },
        });

        const investorShare = round2(cl.profit * 0.5);
        const motoIslaShare = round2(cl.profit * 0.5);

        await tx.profitSplit.create({
          data: {
            id: uid("ps"),
            saleId,
            saleLineId,
            ownerId: cl.ownerId,
            profitShareGross: dec(investorShare),
            status: "ACCRUED",
            createdAt: new Date(createdAt),
          },
        });
        await tx.profitSplit.create({
          data: {
            id: uid("ps"),
            saleId,
            saleLineId,
            ownerId: motoIslaOwnerId,
            profitShareGross: dec(motoIslaShare),
            status: "ACCRUED",
            createdAt: new Date(createdAt),
          },
        });
      }

      for (const [ownerId, cogs] of cogsByOwner.entries()) {
        await tx.capitalMovement.create({
          data: {
            id: uid("cap"),
            ownerId,
            type: "VENTA_COSTO",
            amount: dec(cogs),
            referenceType: "SALE",
            referenceId: saleId,
            date: new Date(body.date),
          },
        });
      }
    });

    return NextResponse.json({
      ok: true,
      saleId,
      totalGross: round2(totalGross),
      terminalFee: round2(totalTerminalFee),
      totalNetAfterFee: round2(totalNetAfterFee),
      commissionRate: round4(commissionRate),
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

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function dec(n: number) {
  return new Prisma.Decimal(round2(n));
}

function dec6(n: number) {
  return new Prisma.Decimal(round6(n));
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function getCommissionRate(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return 0;
  return threeMonthsNoInterest ? 0.0558 : 0.02;
}
