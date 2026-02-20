import { getAllRows } from "@/lib/sheets";

type PurchaseGroup = {
  purchaseId: string;
  supplier: string;
  date: string;
  invoiceRef: string;
  lots: LotView[];
};

type LotView = {
  lotId: string;
  ownerId: string;
  sku: string;
  description: string;
  qtyBought: number;
  qtySold: number;
  qtyAvailable: number;
  unitCostGross: number;
};

export default async function InventarioPage() {
  const [purchases, lots, saleLines] = await Promise.all([
    safeRows("Compras"),
    safeRows("Lotes"),
    safeRows("LineasVenta"),
  ]);

  const purchaseIdx = indexMap(purchases.headers);
  const lotIdx = indexMap(lots.headers);
  const saleLineIdx = indexMap(saleLines.headers);
  const soldByLot = new Map<string, number>();

  for (const row of saleLines.rows) {
    const lotId = row[saleLineIdx.id_lote];
    if (!lotId) continue;
    const qty = toNumber(row[saleLineIdx.cantidad]);
    soldByLot.set(lotId, (soldByLot.get(lotId) ?? 0) + qty);
  }

  const purchaseMeta = new Map<string, { supplier: string; date: string; invoiceRef: string }>();
  for (const row of purchases.rows) {
    const purchaseId = row[purchaseIdx.id_compra];
    if (!purchaseId) continue;
    purchaseMeta.set(purchaseId, {
      supplier: row[purchaseIdx.proveedor] ?? "",
      date: row[purchaseIdx.date] ?? "",
      invoiceRef: row[purchaseIdx.referencia_factura] ?? "",
    });
  }

  const groups = new Map<string, PurchaseGroup>();
  for (const row of lots.rows) {
    const purchaseId = row[lotIdx.id_compra] ?? "SIN_COMPRA";
    const lotId = row[lotIdx.id_lote] ?? "SIN_LOTE";
    const qtyBought = toNumber(row[lotIdx.cantidad_comprada]);
    const qtySold = soldByLot.get(lotId) ?? 0;
    const qtyAvailable = round6(qtyBought - qtySold);

    const lot: LotView = {
      lotId,
      ownerId: row[lotIdx.id_owner] ?? "",
      sku: row[lotIdx.sku_proveedor] ?? "",
      description: row[lotIdx.descripcion] ?? "",
      qtyBought,
      qtySold,
      qtyAvailable,
      unitCostGross: toNumber(row[lotIdx.costo_unitario_bruto]),
    };

    const meta = purchaseMeta.get(purchaseId) ?? { supplier: "", date: "", invoiceRef: "" };
    const current = groups.get(purchaseId);
    if (current) {
      current.lots.push(lot);
    } else {
      groups.set(purchaseId, {
        purchaseId,
        supplier: meta.supplier,
        date: meta.date,
        invoiceRef: meta.invoiceRef,
        lots: [lot],
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
                </div>
              </div>
              <div>
                <div><strong>Stock total:</strong> {round6(totalAvailable)}</div>
                <div><strong>Valor stock:</strong> ${formatMoney(totalCost)}</div>
              </div>
            </div>

            <div className="lot-grid">
              {group.lots.map((lot) => {
                const soldOut = lot.qtyAvailable <= 0;
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

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "0")
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
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
