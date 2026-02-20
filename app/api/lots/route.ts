import { NextResponse } from "next/server";
import { getAllRows } from "@/lib/sheets";

type LotOption = {
  lotId: string;
  sku: string;
  ownerId: string;
  qtyAvailable: number;
  unitCostGross: number;
  description: string;
};

export async function GET() {
  try {
    const [lots, saleLines] = await Promise.all([getAllRows("Lotes"), getAllRows("LineasVenta")]);

    const lotIdx = indexMap(lots.headers);
    const lineIdx = indexMap(saleLines.headers);
    const soldByLot = new Map<string, number>();

    for (const row of saleLines.rows) {
      const lotId = row[lineIdx.id_lote];
      if (!lotId) continue;
      const qty = Number(row[lineIdx.cantidad] ?? 0);
      soldByLot.set(lotId, (soldByLot.get(lotId) ?? 0) + qty);
    }

    const options: LotOption[] = [];

    for (const row of lots.rows) {
      const lotId = row[lotIdx.id_lote];
      if (!lotId) continue;

      const qtyBought = Number(row[lotIdx.cantidad_comprada] ?? 0);
      const qtySold = soldByLot.get(lotId) ?? 0;
      const qtyAvailable = round6(qtyBought - qtySold);
      if (qtyAvailable <= 0) continue;

      options.push({
        lotId,
        sku: row[lotIdx.sku_proveedor] ?? "",
        ownerId: row[lotIdx.id_owner] ?? "",
        qtyAvailable,
        unitCostGross: Number(row[lotIdx.costo_unitario_bruto] ?? 0),
        description: row[lotIdx.descripcion] ?? "",
      });
    }

    options.sort((a, b) => a.lotId.localeCompare(b.lotId));
    return NextResponse.json({ ok: true, lots: options });
  } catch (error) {
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

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
