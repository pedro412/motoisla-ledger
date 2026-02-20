import { NextResponse } from "next/server";
import { z } from "zod";
import { uid } from "@/lib/ids";
import { appendRow, getAllRows } from "@/lib/sheets";
import { appendCapitalMovement } from "@/lib/capital";
import { SaleCreateSchema } from "@/types/schemas";

export async function POST(req: Request) {
  try {
    const body = SaleCreateSchema.parse(await req.json());

    const saleId = uid("sale");
    const createdAt = new Date().toISOString();
    const { investorOwnerId, motoIslaOwnerId } = await resolveProfitOwners();

    const [lots, saleLines] = await Promise.all([getAllRows("Lotes"), getAllRows("LineasVenta")]);
    const idx = indexMap(lots.headers);
    const lineIdx = indexMap(saleLines.headers);
    const lotMap = new Map<string, { ownerId: string; unitCostGross: number; sku: string }>();
    const availableByLot = new Map<string, number>();
    const soldByLot = new Map<string, number>();

    for (const row of saleLines.rows) {
      const lotId = row[lineIdx.id_lote];
      if (!lotId) continue;
      const qty = Number(row[lineIdx.cantidad] ?? 0);
      soldByLot.set(lotId, (soldByLot.get(lotId) ?? 0) + qty);
    }

    for (const row of lots.rows) {
      const lotId = row[idx.id_lote];
      if (!lotId) continue;
      const qtyBought = Number(row[idx.cantidad_comprada] ?? 0);
      const qtySold = soldByLot.get(lotId) ?? 0;
      availableByLot.set(lotId, qtyBought - qtySold);
      lotMap.set(lotId, {
        ownerId: row[idx.id_owner],
        unitCostGross: Number(row[idx.costo_unitario_bruto]),
        sku: row[idx.sku_proveedor],
      });
    }

    const requestedByLot = new Map<string, number>();
    for (const line of body.lines) {
      requestedByLot.set(line.lotId, (requestedByLot.get(line.lotId) ?? 0) + line.qty);
    }

    for (const [lotId, requestedQty] of requestedByLot.entries()) {
      const availableQty = availableByLot.get(lotId);
      if (availableQty == null) {
        throw new Error(`Lot not found: ${lotId}`);
      }
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

      const grossRevenue = line.qty * line.unitPriceGross - line.discountGross;
      const terminalFee = grossRevenue * commissionRate;
      const netRevenue = grossRevenue - terminalFee;
      const cogs = line.qty * lot.unitCostGross;
      const profit = netRevenue - cogs;

      return {
        ...line,
        grossRevenue,
        terminalFee,
        netRevenue,
        cogs,
        profit,
        ownerId: lot.ownerId,
        resolvedSku: line.sku || lot.sku,
      };
    });

    const totalGross = computedLines.reduce((acc, line) => acc + line.grossRevenue, 0);
    const totalTerminalFee = computedLines.reduce((acc, line) => acc + line.terminalFee, 0);
    const totalNetAfterFee = computedLines.reduce((acc, line) => acc + line.netRevenue, 0);
    const cogsByOwner = new Map<string, number>();

    await appendRow("Ventas", [
      saleId,
      body.date,
      body.channel,
      round2(totalGross),
      body.notes ?? "",
      body.terminalPayment ? "SI" : "NO",
      body.threeMonthsNoInterest ? "SI" : "NO",
      round4(commissionRate),
      round2(totalTerminalFee),
      round2(totalNetAfterFee),
      createdAt,
    ]);

    for (const cl of computedLines) {
      cogsByOwner.set(cl.ownerId, (cogsByOwner.get(cl.ownerId) ?? 0) + cl.cogs);

      await appendRow("LineasVenta", [
        uid("sl"),
        saleId,
        cl.lotId,
        cl.resolvedSku,
        cl.qty,
        cl.unitPriceGross,
        cl.discountGross,
        round2(cl.grossRevenue),
        round2(cl.terminalFee),
        round2(cl.netRevenue),
        round2(cl.cogs),
        round2(cl.profit),
      ]);

      const investorShare = cl.profit * 0.5;
      const motoIslaShare = cl.profit * 0.5;

      await appendRow("RepartosUtilidad", [
        uid("ps"),
        saleId,
        investorOwnerId,
        round2(investorShare),
        "ACCRUED",
        createdAt,
      ]);
      await appendRow("RepartosUtilidad", [
        uid("ps"),
        saleId,
        motoIslaOwnerId,
        round2(motoIslaShare),
        "ACCRUED",
        createdAt,
      ]);
    }

    for (const [ownerId, cogs] of cogsByOwner.entries()) {
      await appendCapitalMovement({
        ownerId,
        type: "VENTA_COSTO",
        amount: cogs,
        referenceId: saleId,
        date: body.date,
      });
    }

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

function indexMap(headers: string[]) {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[h] = i;
  });
  return m;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

function getCommissionRate(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return 0;
  return threeMonthsNoInterest ? 0.0558 : 0.02;
}

async function resolveProfitOwners() {
  const investors = await getAllRows("Inversionistas");
  const idx = indexMap(investors.headers);

  const investorOwnerId =
    investors.rows.find((row) => String(row[idx.tipo] ?? "").toUpperCase() === "INVESTOR")?.[idx.id_inversionista] ??
    process.env.DEFAULT_INVESTOR_ID ??
    "INVESTOR_ID";

  const motoIslaOwnerId =
    investors.rows.find((row) => String(row[idx.tipo] ?? "").toUpperCase() === "MOTOISLA")?.[idx.id_inversionista] ??
    process.env.MOTOISLA_OWNER_ID ??
    "MOTOISLA_ID";

  return { investorOwnerId, motoIslaOwnerId };
}
