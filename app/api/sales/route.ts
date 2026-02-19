import { NextResponse } from "next/server";
import { z } from "zod";
import { uid } from "@/lib/ids";
import { appendRow, getAllRows } from "@/lib/sheets";
import { SaleCreateSchema } from "@/types/schemas";

export async function POST(req: Request) {
  try {
    const body = SaleCreateSchema.parse(await req.json());

    const saleId = uid("sale");
    const createdAt = new Date().toISOString();

    const { headers, rows } = await getAllRows("Lots");
    const idx = indexMap(headers);
    const lotMap = new Map<string, { ownerId: string; unitCostGross: number; sku: string }>();

    for (const row of rows) {
      const lotId = row[idx.lot_id];
      if (!lotId) continue;
      lotMap.set(lotId, {
        ownerId: row[idx.owner_id],
        unitCostGross: Number(row[idx.unit_cost_gross]),
        sku: row[idx.supplier_sku],
      });
    }

    const computedLines = body.lines.map((line) => {
      const lot = lotMap.get(line.lotId);
      if (!lot) {
        throw new Error(`Lot not found: ${line.lotId}`);
      }

      const revenue = line.qty * line.unitPriceGross - line.discountGross;
      const cogs = line.qty * lot.unitCostGross;
      const profit = revenue - cogs;

      return {
        ...line,
        revenue,
        cogs,
        profit,
        ownerId: lot.ownerId,
        resolvedSku: line.sku || lot.sku,
      };
    });

    const totalGross = computedLines.reduce((acc, line) => acc + line.revenue, 0);

    await appendRow("Sales", [
      saleId,
      body.date,
      body.channel,
      round2(totalGross),
      body.notes ?? "",
      createdAt,
    ]);

    for (const cl of computedLines) {
      await appendRow("SaleLines", [
        uid("sl"),
        saleId,
        cl.lotId,
        cl.resolvedSku,
        cl.qty,
        cl.unitPriceGross,
        cl.discountGross,
        round2(cl.revenue),
        round2(cl.cogs),
        round2(cl.profit),
      ]);

      const investorShare = cl.profit * 0.5;
      const motoIslaShare = cl.profit * 0.5;

      await appendRow("ProfitSplits", [
        uid("ps"),
        saleId,
        process.env.DEFAULT_INVESTOR_ID ?? "INVESTOR_ID",
        round2(investorShare),
        "ACCRUED",
        createdAt,
      ]);
      await appendRow("ProfitSplits", [
        uid("ps"),
        saleId,
        process.env.MOTOISLA_OWNER_ID ?? "MOTOISLA_ID",
        round2(motoIslaShare),
        "ACCRUED",
        createdAt,
      ]);
    }

    return NextResponse.json({ ok: true, saleId, totalGross: round2(totalGross) });
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
