import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isInvestor, isStaff } from "@/lib/authz";
import { CancelPurchaseButton } from "@/app/inventario/CancelPurchaseButton";

type PurchaseGroup = {
  purchaseId: string;
  supplier: string;
  date: string;
  invoiceRef: string;
  status: "ACTIVE" | "CANCELLED";
  cancelledAt?: string;
  cancelReason?: string;
  lots: LotView[];
};

type LotView = {
  lotId: string;
  ownerId: string;
  status: "ACTIVE" | "CANCELLED";
  sku: string;
  description: string;
  qtyBought: number;
  qtySold: number;
  qtyAvailable: number;
  unitCostGross: number;
};

export default async function InventarioPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section>
        <h1>Inventario por factura</h1>
        <div className="card">No autenticado.</div>
      </section>
    );
  }

  const ownerFilter = isInvestor(user) ? user.ownerId ?? "__none__" : undefined;
  const canManagePurchases = isStaff(user);
  const [purchases, lots, soldRows] = await Promise.all([
    db.purchase.findMany({
      where: ownerFilter ? { ownerId: ownerFilter } : undefined,
      select: { id: true, supplier: true, date: true, invoiceRef: true, status: true, cancelledAt: true, cancelReason: true },
      orderBy: { date: "desc" },
    }),
    db.lot.findMany({
      where: ownerFilter ? { ownerId: ownerFilter } : undefined,
      select: {
        id: true,
        purchaseId: true,
        ownerId: true,
        status: true,
        supplierSku: true,
        description: true,
        qtyBought: true,
        unitCostGross: true,
      },
    }),
    db.saleLine.groupBy({
      by: ["lotId"],
      _sum: { qty: true },
    }),
  ]);

  const soldByLot = new Map(soldRows.map((r) => [r.lotId, toNumber(r._sum.qty)]));
  const purchaseMeta = new Map(
    purchases.map((p) => [
      p.id,
      {
        supplier: p.supplier,
        date: p.date.toISOString().slice(0, 10),
        invoiceRef: p.invoiceRef,
        status: p.status,
        cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString().slice(0, 10) : undefined,
        cancelReason: p.cancelReason ?? undefined,
      },
    ]),
  );

  const groups = new Map<string, PurchaseGroup>();
  for (const lot of lots) {
    const qtyBought = toNumber(lot.qtyBought);
    const qtySold = soldByLot.get(lot.id) ?? 0;
    const qtyAvailable = lot.status === "CANCELLED" ? 0 : round6(qtyBought - qtySold);

    const lotView: LotView = {
      lotId: lot.id,
      ownerId: lot.ownerId,
      status: lot.status,
      sku: lot.supplierSku ?? "",
      description: lot.description,
      qtyBought,
      qtySold,
      qtyAvailable,
      unitCostGross: toNumber(lot.unitCostGross),
    };

    const meta = purchaseMeta.get(lot.purchaseId) ?? {
      supplier: "",
      date: "",
      invoiceRef: "",
      status: "ACTIVE" as const,
      cancelledAt: undefined,
      cancelReason: undefined,
    };
    const current = groups.get(lot.purchaseId);
    if (current) {
      current.lots.push(lotView);
    } else {
      groups.set(lot.purchaseId, {
        purchaseId: lot.purchaseId,
        supplier: meta.supplier,
        date: meta.date,
        invoiceRef: meta.invoiceRef,
        status: meta.status,
        cancelledAt: meta.cancelledAt,
        cancelReason: meta.cancelReason,
        lots: [lotView],
      });
    }
  }

  const sortedGroups = Array.from(groups.values()).sort((a, b) => parseDate(b.date) - parseDate(a.date));

  return (
    <section>
      <h1>Inventario por factura</h1>
      <p>Vista agrupada por compra (`id_compra`) con estado por lote.</p>

      {sortedGroups.length === 0 && (
        <div className="card">
          <p>No hay lotes todavía.</p>
        </div>
      )}

      {sortedGroups.map((group) => {
        const totalAvailable = group.lots.reduce((acc, lot) => acc + lot.qtyAvailable, 0);
        const totalCost = group.lots.reduce((acc, lot) => acc + lot.qtyAvailable * lot.unitCostGross, 0);

        return (
          <div className="card" key={group.purchaseId}>
            <div className="invoice-head">
              <div>
                <h2>Factura / Compra: {group.purchaseId}</h2>
                <div className="invoice-meta">
                  <span>Proveedor: {group.supplier || "-"}</span>
                  <span>Fecha: {group.date || "-"}</span>
                  <span>Ref factura: {group.invoiceRef || "-"}</span>
                  <span>
                    Estado:{" "}
                    <strong style={{ color: group.status === "CANCELLED" ? "#be123c" : "#047857" }}>
                      {group.status === "CANCELLED" ? "CANCELADA" : "ACTIVA"}
                    </strong>
                  </span>
                </div>
                {group.status === "CANCELLED" && (
                  <p style={{ marginTop: 8, fontSize: 13 }}>
                    Cancelada el {group.cancelledAt || "-"}{group.cancelReason ? ` · Motivo: ${group.cancelReason}` : ""}
                  </p>
                )}
              </div>
              <div>
                <div><strong>Stock total:</strong> {round6(totalAvailable)}</div>
                <div><strong>Valor stock:</strong> ${formatMoney(totalCost)}</div>
                {canManagePurchases && group.status === "ACTIVE" && <CancelPurchaseButton purchaseId={group.purchaseId} />}
              </div>
            </div>

            <div className="lot-grid">
              {group.lots.map((lot) => {
                const soldOut = lot.qtyAvailable <= 0 || lot.status === "CANCELLED";
                return (
                  <article key={lot.lotId} className={`lot-card ${soldOut ? "lot-soldout" : "lot-stock"}`}>
                    <div className="lot-card-head">
                      <strong>Lote: {lot.lotId}</strong>
                      <span className="lot-badge">{soldOut ? "VENDIDO" : "EN STOCK"}</span>
                    </div>
                    <div className="lot-body">
                      <div><strong>SKU:</strong> {lot.sku || "-"}</div>
                      <div><strong>Descripción:</strong> {lot.description || "-"}</div>
                      <div><strong>Owner:</strong> {lot.ownerId || "-"}</div>
                      <div><strong>Cant. comprada:</strong> {round6(lot.qtyBought)}</div>
                      <div><strong>Cant. vendida:</strong> {round6(lot.qtySold)}</div>
                      <div><strong>Disponible:</strong> {round6(lot.qtyAvailable)}</div>
                      <div><strong>Costo unitario:</strong> ${formatMoney(lot.unitCostGross)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function parseDate(date: string) {
  if (!date) return Number.NEGATIVE_INFINITY;
  const ts = Date.parse(date);
  return Number.isNaN(ts) ? Number.NEGATIVE_INFINITY : ts;
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
