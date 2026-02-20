import { NextResponse } from "next/server";
import { uid } from "@/lib/ids";
import { getAllRows, getSheetsClient } from "@/lib/sheets";

type LineUpdate = {
  rowNumber: number;
  saleId: string;
  profit: number;
};

export async function POST() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
    }

    const sheets = getSheetsClient();
    const [sales, salesRowsRaw, lineRowsRaw] = await Promise.all([
      getAllRows("Ventas"),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Ventas!A2:Z",
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "LineasVenta!A2:Z",
        valueRenderOption: "UNFORMATTED_VALUE",
      }),
    ]);

    const salesIdx = indexMap(sales.headers);
    const lineHeaders = await getAllRows("LineasVenta");
    const lineIdx = indexMap(lineHeaders.headers);

    requireColumns("Ventas", salesIdx, ["id_venta", "pago_terminal", "meses_sin_intereses_3"]);
    requireColumns("LineasVenta", lineIdx, ["id_venta", "ingreso_bruto", "costo_ventas_bruto", "comision_terminal", "ingreso_neto", "utilidad_bruta"]);

    const rateBySaleId = new Map<string, number>();
    for (const row of salesRowsRaw.data.values ?? []) {
      const saleId = String(row[salesIdx.id_venta] ?? "");
      if (!saleId) continue;
      const terminal = toBool(row[salesIdx.pago_terminal]);
      const msi3 = toBool(row[salesIdx.meses_sin_intereses_3]);
      rateBySaleId.set(saleId, getCommissionRate(terminal, msi3));
    }

    const updates: LineUpdate[] = [];
    const batchData: { range: string; values: (string | number)[][] }[] = [];
    let totalFee = 0;
    let totalNet = 0;

    const comCol = colLetter(lineIdx.comision_terminal + 1);
    const netCol = colLetter(lineIdx.ingreso_neto + 1);
    const profitCol = colLetter(lineIdx.utilidad_bruta + 1);

    const lineRows = lineRowsRaw.data.values ?? [];
    for (let i = 0; i < lineRows.length; i += 1) {
      const rowNumber = i + 2;
      const row = lineRows[i];
      const saleId = String(row[lineIdx.id_venta] ?? "");
      if (!saleId) continue;

      const gross = toNumber(row[lineIdx.ingreso_bruto]);
      const cogs = toNumber(row[lineIdx.costo_ventas_bruto]);
      const rate = rateBySaleId.get(saleId) ?? 0;
      const fee = round2(gross * rate);
      const net = round2(gross - fee);
      const profit = round2(net - cogs);

      totalFee += fee;
      totalNet += net;
      updates.push({ rowNumber, saleId, profit });

      batchData.push({ range: `LineasVenta!${comCol}${rowNumber}`, values: [[fee]] });
      batchData.push({ range: `LineasVenta!${netCol}${rowNumber}`, values: [[net]] });
      batchData.push({ range: `LineasVenta!${profitCol}${rowNumber}`, values: [[profit]] });
    }

    if (batchData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batchData,
        },
      });
    }

    await rebuildProfitSplits(spreadsheetId, updates);
    await updateSalesTotals(spreadsheetId, rateBySaleId, totalFee, totalNet);

    return NextResponse.json({
      ok: true,
      updatedLines: updates.length,
      rebuiltProfitSplitsFromLines: updates.length,
      totalTerminalFee: round2(totalFee),
      totalNetAfterFee: round2(totalNet),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function rebuildProfitSplits(spreadsheetId: string, lines: LineUpdate[]) {
  const sheets = getSheetsClient();
  const { investorOwnerId, motoIslaOwnerId } = await resolveProfitOwners();
  const createdAt = new Date().toISOString();

  const rows: (string | number)[][] = [];
  for (const line of lines) {
    const investorShare = round2(line.profit * 0.5);
    const motoShare = round2(line.profit * 0.5);
    rows.push([uid("ps"), line.saleId, investorOwnerId, investorShare, "ACCRUED", createdAt]);
    rows.push([uid("ps"), line.saleId, motoIslaOwnerId, motoShare, "ACCRUED", createdAt]);
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: "RepartosUtilidad!A2:Z",
  });

  if (!rows.length) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "RepartosUtilidad!A2",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

async function updateSalesTotals(
  spreadsheetId: string,
  rateBySaleId: Map<string, number>,
  _totalFee: number,
  _totalNet: number,
) {
  const sheets = getSheetsClient();
  const sales = await getAllRows("Ventas");
  const salesIdx = indexMap(sales.headers);
  requireColumns("Ventas", salesIdx, ["id_venta", "tasa_comision_terminal", "comision_terminal_total", "total_neto_despues_comision"]);

  const saleRows = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Ventas!A2:Z",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const lineRows = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "LineasVenta!A2:Z",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const lineHeaders = await getAllRows("LineasVenta");
  const lineIdx = indexMap(lineHeaders.headers);

  const feeBySale = new Map<string, number>();
  const netBySale = new Map<string, number>();
  for (const row of lineRows.data.values ?? []) {
    const saleId = String(row[lineIdx.id_venta] ?? "");
    if (!saleId) continue;
    feeBySale.set(saleId, (feeBySale.get(saleId) ?? 0) + toNumber(row[lineIdx.comision_terminal]));
    netBySale.set(saleId, (netBySale.get(saleId) ?? 0) + toNumber(row[lineIdx.ingreso_neto]));
  }

  const rateCol = colLetter(salesIdx.tasa_comision_terminal + 1);
  const feeCol = colLetter(salesIdx.comision_terminal_total + 1);
  const netCol = colLetter(salesIdx.total_neto_despues_comision + 1);

  const updates: { range: string; values: (string | number)[][] }[] = [];
  const salesRows = saleRows.data.values ?? [];
  for (let i = 0; i < salesRows.length; i += 1) {
    const rowNumber = i + 2;
    const row = salesRows[i];
    const saleId = String(row[salesIdx.id_venta] ?? "");
    if (!saleId) continue;

    updates.push({ range: `Ventas!${rateCol}${rowNumber}`, values: [[round4(rateBySaleId.get(saleId) ?? 0)]] });
    updates.push({ range: `Ventas!${feeCol}${rowNumber}`, values: [[round2(feeBySale.get(saleId) ?? 0)]] });
    updates.push({ range: `Ventas!${netCol}${rowNumber}`, values: [[round2(netBySale.get(saleId) ?? 0)]] });
  }

  if (!updates.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates,
    },
  });
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

function toBool(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw === "SI" || raw === "TRUE" || raw === "1" || raw === "YES";
}

function indexMap(headers: string[]) {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[h] = i;
  });
  return m;
}

function requireColumns(sheet: string, map: Record<string, number>, cols: string[]) {
  for (const col of cols) {
    if (map[col] == null) {
      throw new Error(`Falta columna ${col} en ${sheet}. Ejecuta /api/sheets/init primero.`);
    }
  }
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number(String(value ?? "0").replace(/\$/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round4(n: number) {
  return Math.round((n + Number.EPSILON) * 1e4) / 1e4;
}

function getCommissionRate(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return 0;
  return threeMonthsNoInterest ? 0.0558 : 0.02;
}

function colLetter(index1Based: number) {
  let n = index1Based;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
