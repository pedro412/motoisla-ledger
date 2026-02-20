import { uid } from "@/lib/ids";
import { appendRow, getAllRows, getSheetsClient } from "@/lib/sheets";

type CapitalMovementType = "COMPRA" | "VENTA_COSTO";
type ProfitTransferResult = {
  ownerId: string;
  availableProfit: number;
  transferredAmount: number;
  currentCapitalAfter: number;
};

export async function reconcileCapitalMovementsFromLedger() {
  const [purchases, lots, sales, saleLines] = await Promise.all([
    getAllRows("Compras"),
    getAllRows("Lotes"),
    getAllRows("Ventas"),
    getAllRows("LineasVenta"),
  ]);

  const purchasesIdx = indexMap(purchases.headers);
  const lotsIdx = indexMap(lots.headers);
  const salesIdx = indexMap(sales.headers);
  const saleLinesIdx = indexMap(saleLines.headers);

  const purchaseDateById = new Map<string, string>();
  for (const row of purchases.rows) {
    const purchaseId = row[purchasesIdx.id_compra];
    if (!purchaseId) continue;
    purchaseDateById.set(purchaseId, row[purchasesIdx.date] ?? "");
  }

  const saleDateById = new Map<string, string>();
  for (const row of sales.rows) {
    const saleId = row[salesIdx.id_venta];
    if (!saleId) continue;
    saleDateById.set(saleId, row[salesIdx.date] ?? "");
  }

  const lotOwnerById = new Map<string, string>();
  const purchaseMovements: (string | number)[][] = [];
  for (const row of lots.rows) {
    const lotId = row[lotsIdx.id_lote];
    const ownerId = row[lotsIdx.id_owner];
    const purchaseId = row[lotsIdx.id_compra];
    const qtyBought = toNumber(row[lotsIdx.cantidad_comprada]);
    const unitCost = toNumber(row[lotsIdx.costo_unitario_bruto]);
    const purchaseCost = round2(qtyBought * unitCost);
    const date = purchaseDateById.get(purchaseId) || row[lotsIdx.creado_en] || "";

    if (!lotId || !ownerId || purchaseCost === 0) continue;
    lotOwnerById.set(lotId, ownerId);

    purchaseMovements.push([
      uid("cap"),
      ownerId,
      "COMPRA",
      -purchaseCost,
      purchaseId || lotId,
      date,
      new Date().toISOString(),
    ]);
  }

  const saleCostMovements: (string | number)[][] = [];
  for (const row of saleLines.rows) {
    const lotId = row[saleLinesIdx.id_lote];
    const saleId = row[saleLinesIdx.id_venta];
    const ownerId = lotOwnerById.get(lotId);
    const cogs = round2(toNumber(row[saleLinesIdx.costo_ventas_bruto]));
    const date = saleDateById.get(saleId) || "";

    if (!ownerId || cogs === 0) continue;

    saleCostMovements.push([
      uid("cap"),
      ownerId,
      "VENTA_COSTO",
      cogs,
      saleId || lotId,
      date,
      new Date().toISOString(),
    ]);
  }

  const rows = [...purchaseMovements, ...saleCostMovements];
  await replaceCapitalMovements(rows);

  return {
    total: rows.length,
    compras: purchaseMovements.length,
    ventasCosto: saleCostMovements.length,
  };
}

export async function getOwnerInitialCapital(ownerId: string) {
  const { headers, rows } = await getAllRows("Inversionistas");
  const idx = indexMap(headers);

  const ownerIdx = idx.id_inversionista;
  const capitalIdx = idx.capital_inicial;

  if (ownerIdx == null) {
    throw new Error("Falta columna id_inversionista en Inversionistas");
  }
  if (capitalIdx == null) {
    throw new Error("Falta columna capital_inicial en Inversionistas");
  }

  const ownerRow = rows.find((row) => row[ownerIdx] === ownerId);
  if (!ownerRow) {
    throw new Error(`No existe ${ownerId} en Inversionistas`);
  }

  return toNumber(ownerRow[capitalIdx]);
}

export async function getOwnerCapitalSnapshot(ownerId: string) {
  const initialCapital = await getOwnerInitialCapital(ownerId);
  const { headers, rows } = await getAllRows("MovimientosCapital");
  const idx = indexMap(headers);

  const ownerIdx = idx.id_owner;
  const amountIdx = idx.monto;
  if (ownerIdx == null || amountIdx == null) {
    throw new Error("Faltan columnas id_owner/monto en MovimientosCapital");
  }

  let flow = 0;
  for (const row of rows) {
    if (row[ownerIdx] !== ownerId) continue;
    flow += toNumber(row[amountIdx]);
  }

  return {
    initialCapital,
    capitalFlow: flow,
    currentCapital: initialCapital + flow,
  };
}

export async function appendCapitalMovement(params: {
  ownerId: string;
  type: CapitalMovementType | "UTILIDAD_A_CAPITAL";
  amount: number;
  referenceId: string;
  date: string;
}) {
  await appendRow("MovimientosCapital", [
    uid("cap"),
    params.ownerId,
    params.type,
    round2(params.amount),
    params.referenceId,
    params.date,
    new Date().toISOString(),
  ]);
}

export async function transferProfitToCapital(ownerId: string, requestedAmount?: number): Promise<ProfitTransferResult> {
  const [capital, accruedProfit, transferredProfit] = await Promise.all([
    getOwnerCapitalSnapshot(ownerId),
    getOwnerAccruedProfit(ownerId),
    getOwnerTransferredProfit(ownerId),
  ]);

  const availableProfit = round2(accruedProfit - transferredProfit);
  if (availableProfit <= 0) {
    throw new Error(`No hay utilidad disponible para transferir para ${ownerId}`);
  }

  const amount = requestedAmount == null ? availableProfit : round2(requestedAmount);
  if (amount <= 0) {
    throw new Error("El monto a transferir debe ser mayor a 0");
  }
  if (amount > availableProfit) {
    throw new Error(`Monto excede utilidad disponible: disponible=${availableProfit} solicitado=${amount}`);
  }

  await appendCapitalMovement({
    ownerId,
    type: "UTILIDAD_A_CAPITAL",
    amount,
    referenceId: uid("trf"),
    date: new Date().toISOString().slice(0, 10),
  });

  return {
    ownerId,
    availableProfit,
    transferredAmount: amount,
    currentCapitalAfter: round2(capital.currentCapital + amount),
  };
}

function indexMap(headers: string[]) {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[h] = i;
  });
  return m;
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

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

async function getOwnerAccruedProfit(ownerId: string) {
  const { headers, rows } = await getAllRows("RepartosUtilidad");
  const idx = indexMap(headers);
  const ownerIdx = idx.id_owner;
  const amountIdx = idx.participacion_utilidad_bruta;
  if (ownerIdx == null || amountIdx == null) return 0;

  let total = 0;
  for (const row of rows) {
    if (row[ownerIdx] !== ownerId) continue;
    total += toNumber(row[amountIdx]);
  }
  return round2(total);
}

async function getOwnerTransferredProfit(ownerId: string) {
  const { headers, rows } = await getAllRows("MovimientosCapital");
  const idx = indexMap(headers);
  const ownerIdx = idx.id_owner;
  const amountIdx = idx.monto;
  const typeIdx = idx.tipo;
  if (ownerIdx == null || amountIdx == null || typeIdx == null) return 0;

  let total = 0;
  for (const row of rows) {
    if (row[ownerIdx] !== ownerId) continue;
    if (String(row[typeIdx] || "").toUpperCase() !== "UTILIDAD_A_CAPITAL") continue;
    total += toNumber(row[amountIdx]);
  }
  return round2(total);
}

async function replaceCapitalMovements(rows: (string | number)[][]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "MovimientosCapital!A2:Z",
  });

  if (!rows.length) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "MovimientosCapital!A2",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
