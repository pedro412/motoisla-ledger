import { NextResponse } from "next/server";
import { AuditEntity, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import { resolveProfitOwners } from "@/lib/capital";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const { motoIslaOwnerId } = await resolveProfitOwners();
    const [sales, lines] = await Promise.all([
      db.sale.findMany({
        select: {
          id: true,
          terminalPayment: true,
          threeMonthsNoInterest: true,
        },
      }),
      db.saleLine.findMany({
        select: {
          id: true,
          saleId: true,
          lotId: true,
          grossRevenue: true,
          cogsGross: true,
        },
      }),
    ]);

    const lotOwnerRows = await db.lot.findMany({
      where: { id: { in: lines.map((l) => l.lotId) } },
      select: { id: true, ownerId: true },
    });
    const ownerByLot = new Map(lotOwnerRows.map((l) => [l.id, l.ownerId]));

    const saleMap = new Map(sales.map((s) => [s.id, s]));
    const lineUpdates: {
      id: string;
      saleId: string;
      ownerId: string;
      terminalFee: number;
      netRevenue: number;
      profit: number;
    }[] = [];

    for (const line of lines) {
      const sale = saleMap.get(line.saleId);
      const ownerId = ownerByLot.get(line.lotId);
      if (!sale || !ownerId) continue;

      const rate = getCommissionRate(sale.terminalPayment, sale.threeMonthsNoInterest);
      const gross = toNumber(line.grossRevenue);
      const cogs = toNumber(line.cogsGross);
      const fee = round2(gross * rate);
      const net = round2(gross - fee);
      const profit = round2(net - cogs);
      lineUpdates.push({ id: line.id, saleId: line.saleId, ownerId, terminalFee: fee, netRevenue: net, profit });
    }

    await db.$transaction(async (tx) => {
      for (const lu of lineUpdates) {
        await tx.saleLine.update({
          where: { id: lu.id },
          data: {
            terminalFee: dec(lu.terminalFee),
            netRevenue: dec(lu.netRevenue),
            profitGross: dec(lu.profit),
          },
        });
      }

      await tx.profitSplit.deleteMany({});
      for (const lu of lineUpdates) {
        await tx.profitSplit.create({
          data: {
            id: uid("ps"),
            saleId: lu.saleId,
            saleLineId: lu.id,
            ownerId: lu.ownerId,
            profitShareGross: dec(round2(lu.profit * 0.5)),
            status: "ACCRUED",
          },
        });
        await tx.profitSplit.create({
          data: {
            id: uid("ps"),
            saleId: lu.saleId,
            saleLineId: lu.id,
            ownerId: motoIslaOwnerId,
            profitShareGross: dec(round2(lu.profit * 0.5)),
            status: "ACCRUED",
          },
        });
      }

      const groupedBySale = new Map<string, { fee: number; net: number; rate: number }>();
      for (const lu of lineUpdates) {
        const sale = saleMap.get(lu.saleId);
        if (!sale) continue;
        const rate = getCommissionRate(sale.terminalPayment, sale.threeMonthsNoInterest);
        const curr = groupedBySale.get(lu.saleId) ?? { fee: 0, net: 0, rate };
        curr.fee += lu.terminalFee;
        curr.net += lu.netRevenue;
        groupedBySale.set(lu.saleId, curr);
      }

      for (const [saleId, totals] of groupedBySale.entries()) {
        await tx.sale.update({
          where: { id: saleId },
          data: {
            updatedByUserId: user.id,
            commissionRate: dec6(totals.rate),
            terminalFeeTotal: dec(totals.fee),
            totalNetAfterFee: dec(totals.net),
          },
        });
      }

      await logAudit(
        {
          actorUserId: user.id,
          action: "sale.recalculated",
          entity: AuditEntity.SALE,
          entityId: "bulk",
          payload: {
            updatedLines: lineUpdates.length,
            updatedSales: groupedBySale.size,
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, updatedLines: lineUpdates.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function getCommissionRate(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return 0;
  return threeMonthsNoInterest ? 0.0558 : 0.02;
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
