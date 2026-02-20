import { getAllRows } from "@/lib/sheets";
import { TransferProfitButton } from "@/app/dashboard/TransferProfitButton";

type OwnerTotals = Record<
  string,
  { initialCapital: number; inventoryCost: number; accruedProfit: number; capitalFlow: number }
>;
type CapitalMovement = { date: string; type: string; amount: number; referenceId: string };

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function DashboardPage() {
  const [sales, saleLines, lots, profitSplits, purchases, investors, capitalMoves] = await Promise.all([
    safeRows("Ventas"),
    safeRows("LineasVenta"),
    safeRows("Lotes"),
    safeRows("RepartosUtilidad"),
    safeRows("Compras"),
    safeRows("Inversionistas"),
    safeRows("MovimientosCapital"),
  ]);

  const totalSales = sumColumn(sales.headers, sales.rows, "total_bruto");
  const totalTerminalFees = sumColumn(sales.headers, sales.rows, "comision_terminal_total");
  const totalPurchases = sumColumn(purchases.headers, purchases.rows, "total_bruto");
  const totalProfit = sumColumn(saleLines.headers, saleLines.rows, "utilidad_bruta");
  const ownerTotals: OwnerTotals = {};
  const capitalMovementsByOwner = new Map<string, CapitalMovement[]>();
  const saleMetricsBySaleId = new Map<string, { netRevenue: number; profit: number; marginPct: number }>();
  const salePaymentBySaleId = new Map<string, string>();

  const lotIdx = indexMap(lots.headers);
  const saleLineIdx = indexMap(saleLines.headers);
  const salesIdx = indexMap(sales.headers);
  const invIdx = indexMap(investors.headers);
  const capitalIdx = indexMap(capitalMoves.headers);
  const soldByLot = new Map<string, number>();

  const investorId =
    investors.rows.find((row) => String(row[invIdx.tipo] ?? "").toUpperCase() === "INVESTOR")?.[invIdx.id_inversionista] ??
    investors.rows[0]?.[invIdx.id_inversionista] ??
    process.env.DEFAULT_INVESTOR_ID ??
    "inv_default";

  for (const row of investors.rows) {
    const ownerId = row[invIdx.id_inversionista] || "UNKNOWN";
    const initialCapital = toNumber(row[invIdx.capital_inicial]);
    ownerTotals[ownerId] = {
      initialCapital,
      inventoryCost: 0,
      accruedProfit: 0,
      capitalFlow: 0,
    };
  }

  for (const row of saleLines.rows) {
    const lotId = row[saleLineIdx.id_lote];
    const qty = toNumber(row[saleLineIdx.cantidad]);
    soldByLot.set(lotId, (soldByLot.get(lotId) ?? 0) + qty);
  }

  for (const row of sales.rows) {
    const saleId = row[salesIdx.id_venta];
    if (!saleId) continue;
    salePaymentBySaleId.set(
      saleId,
      paymentLabelFromSale(row[salesIdx.pago_terminal], row[salesIdx.meses_sin_intereses_3], row[salesIdx.tasa_comision_terminal]),
    );
  }

  for (const row of saleLines.rows) {
    const saleId = row[saleLineIdx.id_venta];
    if (!saleId) continue;
    const netRevenue = toNumber(row[saleLineIdx.ingreso_neto] ?? row[saleLineIdx.ingreso_bruto]);
    const profit = toNumber(row[saleLineIdx.utilidad_bruta]);
    const current = saleMetricsBySaleId.get(saleId) ?? { netRevenue: 0, profit: 0, marginPct: 0 };
    current.netRevenue += netRevenue;
    current.profit += profit;
    saleMetricsBySaleId.set(saleId, current);
  }
  for (const [saleId, metric] of saleMetricsBySaleId.entries()) {
    metric.marginPct = metric.netRevenue === 0 ? 0 : (metric.profit / metric.netRevenue) * 100;
    saleMetricsBySaleId.set(saleId, metric);
  }

  for (const row of lots.rows) {
    const ownerId = row[lotIdx.id_owner] || "UNKNOWN";
    const lotId = row[lotIdx.id_lote];
    const qtyBought = toNumber(row[lotIdx.cantidad_comprada]);
    const unitCost = toNumber(row[lotIdx.costo_unitario_bruto]);
    const qtySold = soldByLot.get(lotId) ?? 0;
    const qtyAvailable = qtyBought - qtySold;

    ownerTotals[ownerId] ??= { initialCapital: 0, inventoryCost: 0, accruedProfit: 0, capitalFlow: 0 };
    ownerTotals[ownerId].inventoryCost += qtyAvailable * unitCost;
  }

  const splitIdx = indexMap(profitSplits.headers);
  for (const row of profitSplits.rows) {
    const ownerId = row[splitIdx.id_owner] || "UNKNOWN";
    const share = toNumber(row[splitIdx.participacion_utilidad_bruta]);
    ownerTotals[ownerId] ??= { initialCapital: 0, inventoryCost: 0, accruedProfit: 0, capitalFlow: 0 };
    ownerTotals[ownerId].accruedProfit += share;
  }

  for (const row of capitalMoves.rows) {
    const ownerId = row[capitalIdx.id_owner] || "UNKNOWN";
    const type = row[capitalIdx.tipo] || "OTRO";
    const amount = toNumber(row[capitalIdx.monto]);
    const date = row[capitalIdx.fecha] || row[capitalIdx.creado_en] || "";
    const referenceId = row[capitalIdx.referencia_id] || "";

    ownerTotals[ownerId] ??= { initialCapital: 0, inventoryCost: 0, accruedProfit: 0, capitalFlow: 0 };
    ownerTotals[ownerId].capitalFlow += amount;

    const ownerMoves = capitalMovementsByOwner.get(ownerId) ?? [];
    ownerMoves.push({ date, type, amount, referenceId });
    capitalMovementsByOwner.set(ownerId, ownerMoves);
  }

  const investorTotals = ownerTotals[investorId] ?? {
    initialCapital: 0,
    inventoryCost: 0,
    accruedProfit: 0,
    capitalFlow: 0,
  };
  const legacyInvestorId =
    process.env.DEFAULT_INVESTOR_ID && process.env.DEFAULT_INVESTOR_ID !== investorId
      ? process.env.DEFAULT_INVESTOR_ID
      : "";
  const legacyInvestorTotals =
    legacyInvestorId && ownerTotals[legacyInvestorId]
      ? ownerTotals[legacyInvestorId]
      : { initialCapital: 0, inventoryCost: 0, accruedProfit: 0, capitalFlow: 0 };
  const investorAccruedProfit = investorTotals.accruedProfit + legacyInvestorTotals.accruedProfit;
  const transferredFromProfit = sumOwnerByType(capitalMoves.headers, capitalMoves.rows, investorId, "UTILIDAD_A_CAPITAL");
  const investorAvailableProfitToTransfer = Math.max(0, round2(investorAccruedProfit - transferredFromProfit));
  const investorInitialCapital = investorTotals.initialCapital;
  const investorCurrentCapital = investorInitialCapital + investorTotals.capitalFlow;
  const investorCapitalPlusInventory = investorCurrentCapital + investorTotals.inventoryCost;
  const investorMovements = (capitalMovementsByOwner.get(investorId) ?? [])
    .slice()
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const investorRunningBalance = buildRunningBalance(investorInitialCapital, investorMovements);

  return (
    <section>
      <h1>Dashboard MotoIsla Ledger</h1>
      <div className="grid">
        <div className="card kpi-card kpi-sales">
          <div className="kpi-label">Ventas brutas</div>
          <div className="kpi">${formatMoney(totalSales)}</div>
        </div>
        <div className="card kpi-card kpi-fees">
          <div className="kpi-label">Comisión terminal</div>
          <div className="kpi">${formatMoney(totalTerminalFees)}</div>
        </div>
        <div className="card kpi-card kpi-purchases">
          <div className="kpi-label">Compras brutas</div>
          <div className="kpi">${formatMoney(totalPurchases)}</div>
        </div>
        <div className="card kpi-card kpi-profit">
          <div className="kpi-label">Utilidad (LineasVenta)</div>
          <div className="kpi">${formatMoney(totalProfit)}</div>
        </div>
      </div>

      <div className="card kpi-card kpi-capital">
        <h2>Capital del inversionista ({investorId})</h2>
        <div className="capital-grid">
          <div className="capital-item capital-initial">
            <div className="capital-label">Capital inicial</div>
            <div className="capital-value">${formatMoney(investorInitialCapital)}</div>
          </div>
          <div className="capital-item capital-current">
            <div className="capital-label">Capital actual</div>
            <div className="capital-value">${formatMoney(investorCurrentCapital)}</div>
          </div>
          <div className="capital-item capital-stock">
            <div className="capital-label">Inventario actual</div>
            <div className="capital-value">${formatMoney(investorTotals.inventoryCost)}</div>
          </div>
          <div className="capital-item capital-total">
            <div className="capital-label">Capital + Inventario</div>
            <div className="capital-value">${formatMoney(investorCapitalPlusInventory)}</div>
          </div>
          <div className="capital-item capital-profit">
            <div className="capital-label">Utilidad acumulada</div>
            <div className="capital-value">${formatMoney(investorAccruedProfit)}</div>
          </div>
          <div className="capital-item capital-transferred">
            <div className="capital-label">Utilidad ya transferida</div>
            <div className="capital-value">${formatMoney(transferredFromProfit)}</div>
          </div>
          <div className="capital-item capital-available">
            <div className="capital-label">Utilidad disponible para transferir</div>
            <div className="capital-value">${formatMoney(investorAvailableProfitToTransfer)}</div>
          </div>
        </div>
        <TransferProfitButton ownerId={investorId} available={investorAvailableProfitToTransfer} />
        {legacyInvestorId && legacyInvestorTotals.accruedProfit !== 0 && (
          <p style={{ marginTop: 8, fontSize: 12, color: "#4b5563" }}>
            Incluye utilidad histórica registrada con owner legado: {legacyInvestorId}.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Movimientos de capital del inversionista</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Cobro venta</th>
              <th>Utilidad venta</th>
              <th>Margen venta</th>
              <th>Capital después</th>
            </tr>
          </thead>
          <tbody>
            {investorRunningBalance.map((item) => (
              <tr key={`${item.date}-${item.type}-${item.amount}`} className={`move-row ${movementRowClass(item.type)}`}>
                <td>{item.date || "-"}</td>
                <td>
                  <span className={`move-badge ${movementBadgeClass(item.type)}`}>{labelForMovementType(item.type)}</span>
                </td>
                <td>{item.amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(item.amount))}</td>
                <td>
                  {item.type === "VENTA_COSTO" && item.referenceId
                    ? salePaymentBySaleId.get(item.referenceId) ?? "-"
                    : "-"}
                </td>
                <td>
                  {item.type === "VENTA_COSTO" && item.referenceId
                    ? `$${formatMoney(saleMetricsBySaleId.get(item.referenceId)?.profit ?? 0)}`
                    : "-"}
                </td>
                <td>
                  {item.type === "VENTA_COSTO" && item.referenceId
                    ? `${formatPct(saleMetricsBySaleId.get(item.referenceId)?.marginPct ?? 0)}`
                    : "-"}
                </td>
                <td>${formatMoney(item.balanceAfter)}</td>
              </tr>
            ))}
            {investorRunningBalance.length === 0 && (
              <tr>
                <td colSpan={7}>Sin movimientos todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Inventario a costo y utilidad acumulada por owner</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Inventario costo</th>
              <th>Capital inicial</th>
              <th>Capital actual</th>
              <th>Utilidad acumulada</th>
              <th>Flujo neto de capital</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(ownerTotals).map(([ownerId, totals]) => (
              <tr key={ownerId}>
                <td>{ownerId}</td>
                <td>${formatMoney(totals.inventoryCost)}</td>
                <td>${formatMoney(totals.initialCapital)}</td>
                <td>${formatMoney(totals.initialCapital + totals.capitalFlow)}</td>
                <td>${formatMoney(totals.accruedProfit)}</td>
                <td>${formatMoney(totals.capitalFlow)}</td>
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
  return rows.reduce((acc, row) => acc + toNumber(row[idx]), 0);
}

function sumOwnerByType(headers: string[], rows: string[][], ownerId: string, type: string) {
  const idxOwner = headers.indexOf("id_owner");
  const idxType = headers.indexOf("tipo");
  const idxAmount = headers.indexOf("monto");
  if (idxOwner === -1 || idxType === -1 || idxAmount === -1) return 0;

  return round2(
    rows.reduce((acc, row) => {
      if (row[idxOwner] !== ownerId) return acc;
      if (String(row[idxType] || "").toUpperCase() !== type.toUpperCase()) return acc;
      return acc + toNumber(row[idxAmount]);
    }, 0),
  );
}

function formatMoney(n: number) {
  return moneyFormatter.format(n);
}

function formatPct(n: number) {
  return `${n.toFixed(2)}%`;
}

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const normalized = String(value ?? "0")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(date: string) {
  if (!date) return Number.POSITIVE_INFINITY;
  const ts = Date.parse(date);
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}

function buildRunningBalance(initialCapital: number, movements: CapitalMovement[]) {
  let balance = initialCapital;
  return movements.map((movement) => {
    balance += movement.amount;
    return {
      ...movement,
      balanceAfter: balance,
    };
  });
}

function labelForMovementType(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "Compra (sale capital)";
  if (normalized === "VENTA_COSTO") return "Venta (regresa costo a capital)";
  if (normalized === "UTILIDAD_A_CAPITAL") return "Transferencia de utilidad a capital";
  return normalized || "OTRO";
}

function movementBadgeClass(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "move-badge-compra";
  if (normalized === "VENTA_COSTO") return "move-badge-venta";
  if (normalized === "UTILIDAD_A_CAPITAL") return "move-badge-transfer";
  return "move-badge-other";
}

function movementRowClass(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "move-row-compra";
  if (normalized === "VENTA_COSTO") return "move-row-venta";
  if (normalized === "UTILIDAD_A_CAPITAL") return "move-row-transfer";
  return "";
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function paymentLabelFromSale(pagoTerminalRaw: string | number | undefined, msiRaw: string | number | undefined, rateRaw: string | number | undefined) {
  const terminal = toBool(pagoTerminalRaw);
  const msi3 = toBool(msiRaw);
  const rate = toNumber(rateRaw);
  if (!terminal) return "Sin terminal";
  if (msi3) return "Terminal 3 MSI (5.58%)";
  if (rate > 0) return `Terminal (tasa ${(rate * 100).toFixed(2)}%)`;
  return "Terminal débito/1 exhibición (2.00%)";
}

function toBool(value: string | number | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized === "SI" || normalized === "TRUE" || normalized === "1" || normalized === "YES";
}
