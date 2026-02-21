import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isInvestor } from "@/lib/authz";

type LotOption = {
  lotId: string;
  sku: string;
  ownerId: string;
  qtyAvailable: number;
  unitCostGross: number;
  description: string;
};

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedOwnerId = searchParams.get("ownerId");
    const ownerId = isInvestor(user) ? user.ownerId ?? "" : requestedOwnerId;
    if (isInvestor(user) && !ownerId) {
      return NextResponse.json({ ok: false, error: "Usuario inversionista sin owner asignado" }, { status: 400 });
    }

    const lots = await db.lot.findMany({
      where: ownerId ? { ownerId } : undefined,
      select: {
        id: true,
        ownerId: true,
        supplierSku: true,
        description: true,
        unitCostGross: true,
        qtyBought: true,
      },
      orderBy: { id: "asc" },
    });

    const soldRows = await db.saleLine.groupBy({
      by: ["lotId"],
      where: { lotId: { in: lots.map((l) => l.id) } },
      _sum: { qty: true },
    });
    const soldByLot = new Map(soldRows.map((r) => [r.lotId, toNumber(r._sum.qty)]));

    const options: LotOption[] = [];
    for (const lot of lots) {
      const qtyAvailable = round6(toNumber(lot.qtyBought) - (soldByLot.get(lot.id) ?? 0));
      if (qtyAvailable <= 0) continue;
      options.push({
        lotId: lot.id,
        sku: lot.supplierSku ?? "",
        ownerId: lot.ownerId,
        qtyAvailable,
        unitCostGross: toNumber(lot.unitCostGross),
        description: lot.description,
      });
    }

    return NextResponse.json({ ok: true, lots: options });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
