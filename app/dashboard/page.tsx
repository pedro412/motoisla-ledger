import Link from "next/link";
import { OwnerType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { TransferProfitButton } from "@/app/dashboard/TransferProfitButton";

type CapitalMovementView = {
  date: string;
  type: string;
  amount: number;
  referenceId: string;
  balanceAfter: number;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { ownerId?: string };
}) {
  const owners = await db.owner.findMany({ orderBy: { createdAt: "asc" } });
  const investorOwners = owners.filter((o) => o.type === OwnerType.INVESTOR);
  const selectedOwnerId = searchParams?.ownerId ?? investorOwners[0]?.id ?? owners[0]?.id ?? "";

  if (!selectedOwnerId) {
    return (
      <section>
        <h1>Dashboard MotoIsla Ledger</h1>
        <div className="card">No hay owners configurados en la base de datos.</div>
      </section>
    );
  }

  const owner = owners.find((o) => o.id === selectedOwnerId);
  if (!owner) {
    return (
      <section>
        <h1>Dashboard MotoIsla Ledger</h1>
        <div className="card">Owner no encontrado: {selectedOwnerId}</div>
      </section>
    );
  }

  const [purchases, lots, profitSplits, movements] = await Promise.all([
    db.purchase.findMany({
      where: { ownerId: selectedOwnerId },
      select: { totalGross: true },
    }),
    db.lot.findMany({
      where: { ownerId: selectedOwnerId },
      select: { id: true, qtyBought: true, unitCostGross: true },
    }),
    db.profitSplit.findMany({
      where: { ownerId: selectedOwnerId },
      select: { profitShareGross: true },
    }),
    db.capitalMovement.findMany({
      where: { ownerId: selectedOwnerId },
      select: { type: true, amount: true, date: true, referenceId: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const lotIds = lots.map((l) => l.id);
  const [soldRows, saleLines] =
    lotIds.length > 0
      ? await Promise.all([
          db.saleLine.groupBy({
            by: ["lotId"],
            where: { lotId: { in: lotIds } },
            _sum: { qty: true },
          }),
          db.saleLine.findMany({
            where: { lotId: { in: lotIds } },
            select: { saleId: true, netRevenue: true, profitGross: true, cogsGross: true, lotId: true },
          }),
        ])
      : [[], []];

  const salesBySaleId = new Map<string, { netRevenue: number; profit: number }>();
  for (const sl of saleLines) {
    const cur = salesBySaleId.get(sl.saleId) ?? { netRevenue: 0, profit: 0 };
    cur.netRevenue += toNumber(sl.netRevenue);
    cur.profit += toNumber(sl.profitGross);
    salesBySaleId.set(sl.saleId, cur);
  }

  const saleIds = Array.from(salesBySaleId.keys());
  const sales = saleIds.length
    ? await db.sale.findMany({
        where: { id: { in: saleIds } },
        select: {
          id: true,
          terminalPayment: true,
          threeMonthsNoInterest: true,
          commissionRate: true,
        },
      })
    : [];
  const salePaymentBySaleId = new Map(
    sales.map((s) => [s.id, paymentLabelFromSale(s.terminalPayment, s.threeMonthsNoInterest, toNumber(s.commissionRate))]),
  );

  const totalSales = round2(
    saleLines.reduce((acc, line) => acc + toNumber(line.netRevenue) + toNumber(line.cogsGross), 0),
  );
  const totalPurchases = round2(purchases.reduce((acc, p) => acc + toNumber(p.totalGross), 0));
  const totalProfit = round2(saleLines.reduce((acc, line) => acc + toNumber(line.profitGross), 0));
  const totalTerminalFees = round2(totalSales - totalProfit - saleLines.reduce((acc, l) => acc + toNumber(l.cogsGross), 0));

  const soldByLot = new Map(soldRows.map((r) => [r.lotId, toNumber(r._sum.qty)]));
  const inventoryCost = round2(
    lots.reduce((acc, lot) => {
      const available = toNumber(lot.qtyBought) - (soldByLot.get(lot.id) ?? 0);
      return acc + available * toNumber(lot.unitCostGross);
    }, 0),
  );

  const accruedProfit = round2(profitSplits.reduce((acc, split) => acc + toNumber(split.profitShareGross), 0));
  const transferredFromProfit = round2(
    movements
      .filter((m) => m.type === "UTILIDAD_A_CAPITAL")
      .reduce((acc, m) => acc + toNumber(m.amount), 0),
  );
  const availableToTransfer = round2(Math.max(0, accruedProfit - transferredFromProfit));
  const capitalFlow = round2(movements.reduce((acc, m) => acc + toNumber(m.amount), 0));
  const currentCapital = round2(toNumber(owner.initialCapital) + capitalFlow);
  const capitalPlusInventory = round2(currentCapital + inventoryCost);

  const runningMoves: CapitalMovementView[] = [];
  let running = toNumber(owner.initialCapital);
  for (const m of movements) {
    running = round2(running + toNumber(m.amount));
    runningMoves.push({
      date: m.date.toISOString().slice(0, 10),
      type: m.type,
      amount: toNumber(m.amount),
      referenceId: m.referenceId,
      balanceAfter: running,
    });
  }

  return (
    <section>
      <h1>Dashboard MotoIsla Ledger</h1>

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {investorOwners.map((o) => (
            <Link
              key={o.id}
              href={`/dashboard?ownerId=${encodeURIComponent(o.id)}`}
              className={o.id === selectedOwnerId ? "move-badge move-badge-transfer" : "move-badge move-badge-other"}
            >
              {o.name} ({o.id})
            </Link>
          ))}
        </div>
      </div>

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
        <h2>Capital del inversionista ({owner.name})</h2>
        <div className="capital-grid">
          <div className="capital-item capital-initial">
            <div className="capital-label">Capital inicial</div>
            <div className="capital-value">${formatMoney(toNumber(owner.initialCapital))}</div>
          </div>
          <div className="capital-item capital-current">
            <div className="capital-label">Capital actual</div>
            <div className="capital-value">${formatMoney(currentCapital)}</div>
          </div>
          <div className="capital-item capital-stock">
            <div className="capital-label">Inventario actual</div>
            <div className="capital-value">${formatMoney(inventoryCost)}</div>
          </div>
          <div className="capital-item capital-total">
            <div className="capital-label">Capital + Inventario</div>
            <div className="capital-value">${formatMoney(capitalPlusInventory)}</div>
          </div>
          <div className="capital-item capital-profit">
            <div className="capital-label">Utilidad acumulada</div>
            <div className="capital-value">${formatMoney(accruedProfit)}</div>
          </div>
          <div className="capital-item capital-transferred">
            <div className="capital-label">Utilidad ya transferida</div>
            <div className="capital-value">${formatMoney(transferredFromProfit)}</div>
          </div>
          <div className="capital-item capital-available">
            <div className="capital-label">Utilidad disponible para transferir</div>
            <div className="capital-value">${formatMoney(availableToTransfer)}</div>
          </div>
        </div>
        <TransferProfitButton ownerId={selectedOwnerId} available={availableToTransfer} />
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
            {runningMoves.map((item) => {
              const sale = salesBySaleId.get(item.referenceId);
              const margin = sale && sale.netRevenue > 0 ? (sale.profit / sale.netRevenue) * 100 : 0;
              return (
                <tr key={`${item.date}-${item.type}-${item.amount}`} className={`move-row ${movementRowClass(item.type)}`}>
                  <td>{item.date || "-"}</td>
                  <td>
                    <span className={`move-badge ${movementBadgeClass(item.type)}`}>{labelForMovementType(item.type)}</span>
                  </td>
                  <td>{item.amount >= 0 ? "+" : "-"}${formatMoney(Math.abs(item.amount))}</td>
                  <td>{item.type === "VENTA_COSTO" ? (salePaymentBySaleId.get(item.referenceId) ?? "-") : "-"}</td>
                  <td>{item.type === "VENTA_COSTO" ? `$${formatMoney(sale?.profit ?? 0)}` : "-"}</td>
                  <td>{item.type === "VENTA_COSTO" ? `${margin.toFixed(2)}%` : "-"}</td>
                  <td>${formatMoney(item.balanceAfter)}</td>
                </tr>
              );
            })}
            {runningMoves.length === 0 && (
              <tr>
                <td colSpan={7}>Sin movimientos todavía.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatMoney(n: number) {
  return moneyFormatter.format(n);
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function labelForMovementType(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "Compra (sale capital)";
  if (normalized === "VENTA_COSTO") return "Venta (regresa costo a capital)";
  if (normalized === "UTILIDAD_A_CAPITAL") return "Transferencia de utilidad a capital";
  if (normalized === "CAPITAL_INICIAL") return "Capital inicial";
  if (normalized === "AJUSTE_CAPITAL_INICIAL") return "Ajuste capital inicial";
  return normalized || "OTRO";
}

function movementBadgeClass(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "move-badge-compra";
  if (normalized === "VENTA_COSTO") return "move-badge-venta";
  if (normalized === "UTILIDAD_A_CAPITAL" || normalized === "CAPITAL_INICIAL" || normalized === "AJUSTE_CAPITAL_INICIAL") {
    return "move-badge-transfer";
  }
  return "move-badge-other";
}

function movementRowClass(type: string) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "COMPRA") return "move-row-compra";
  if (normalized === "VENTA_COSTO") return "move-row-venta";
  if (normalized === "UTILIDAD_A_CAPITAL" || normalized === "CAPITAL_INICIAL" || normalized === "AJUSTE_CAPITAL_INICIAL") {
    return "move-row-transfer";
  }
  return "";
}

function paymentLabelFromSale(terminalPayment: boolean, threeMonthsNoInterest: boolean, rate: number) {
  if (!terminalPayment) return "Sin terminal";
  if (threeMonthsNoInterest) return "Terminal 3 MSI (5.58%)";
  if (rate > 0) return `Terminal (tasa ${(rate * 100).toFixed(2)}%)`;
  return "Terminal débito/1 exhibición (2.00%)";
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
