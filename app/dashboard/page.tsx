import { getAllRows } from "@/lib/sheets";

type OwnerTotals = Record<string, { inventoryCost: number; accruedProfit: number }>;

export default async function DashboardPage() {
  const [sales, saleLines, lots, profitSplits, purchases] = await Promise.all([
    safeRows("Sales"),
    safeRows("SaleLines"),
    safeRows("Lots"),
    safeRows("ProfitSplits"),
    safeRows("Purchases"),
  ]);

  const totalSales = sumColumn(sales.headers, sales.rows, "total_gross");
  const totalPurchases = sumColumn(purchases.headers, purchases.rows, "total_gross");
  const totalProfit = sumColumn(saleLines.headers, saleLines.rows, "profit_gross");

  const ownerTotals: OwnerTotals = {};

  const lotIdx = indexMap(lots.headers);
  const saleLineIdx = indexMap(saleLines.headers);
  const soldByLot = new Map<string, number>();

  for (const row of saleLines.rows) {
    const lotId = row[saleLineIdx.lot_id];
    const qty = Number(row[saleLineIdx.qty] ?? 0);
    soldByLot.set(lotId, (soldByLot.get(lotId) ?? 0) + qty);
  }

  for (const row of lots.rows) {
    const ownerId = row[lotIdx.owner_id] || "UNKNOWN";
    const lotId = row[lotIdx.lot_id];
    const qtyBought = Number(row[lotIdx.qty_bought] ?? 0);
    const unitCost = Number(row[lotIdx.unit_cost_gross] ?? 0);
    const qtySold = soldByLot.get(lotId) ?? 0;
    const qtyAvailable = qtyBought - qtySold;

    ownerTotals[ownerId] ??= { inventoryCost: 0, accruedProfit: 0 };
    ownerTotals[ownerId].inventoryCost += qtyAvailable * unitCost;
  }

  const splitIdx = indexMap(profitSplits.headers);
  for (const row of profitSplits.rows) {
    const ownerId = row[splitIdx.owner_id] || "UNKNOWN";
    const share = Number(row[splitIdx.profit_share_gross] ?? 0);
    ownerTotals[ownerId] ??= { inventoryCost: 0, accruedProfit: 0 };
    ownerTotals[ownerId].accruedProfit += share;
  }

  return (
    <section>
      <h1>Dashboard MotoIsla Ledger</h1>
      <div className="grid">
        <div className="card"><div>Ventas brutas</div><div className="kpi">${round2(totalSales)}</div></div>
        <div className="card"><div>Compras brutas</div><div className="kpi">${round2(totalPurchases)}</div></div>
        <div className="card"><div>Utilidad (SaleLines)</div><div className="kpi">${round2(totalProfit)}</div></div>
      </div>

      <div className="card">
        <h2>Inventario a costo y utilidad acumulada por owner</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Inventario costo</th>
              <th>Utilidad accrued</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ownerTotals).map(([ownerId, totals]) => (
              <tr key={ownerId}>
                <td>{ownerId}</td>
                <td>${round2(totals.inventoryCost)}</td>
                <td>${round2(totals.accruedProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function safeRows(sheetName: string) {
  try {
    return await getAllRows(sheetName);
  } catch {
    return { headers: [] as string[], rows: [] as string[][] };
  }
}

function indexMap(headers: string[]) {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[h] = i;
  });
  return m;
}

function sumColumn(headers: string[], rows: string[][], col: string) {
  const idx = headers.indexOf(col);
  if (idx === -1) return 0;
  return rows.reduce((acc, row) => acc + Number(row[idx] ?? 0), 0);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
