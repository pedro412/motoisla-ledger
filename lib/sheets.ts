import "server-only";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const LEDGER_SCHEMA: Record<string, string[]> = {
  Inversionistas: ["id_inversionista", "nombre", "tipo", "capital_inicial", "creado_en"],
  Compras: [
    "id_compra",
    "date",
    "proveedor",
    "referencia_factura",
    "subtotal_neto",
    "impuesto_total",
    "total_bruto",
    "tasa_impuesto",
    "id_documento_raw",
    "creado_en",
  ],
  LineasCompra: [
    "id_linea_compra",
    "id_compra",
    "numero_linea",
    "sku_proveedor",
    "unidad",
    "descripcion_raw",
    "cantidad",
    "total_linea_neto",
    "clave_sat_producto",
    "pedimento",
    "impuesto_asignado_linea",
    "total_linea_bruto",
    "costo_unitario_neto_exacto",
    "costo_unitario_bruto_exacto",
  ],
  Lotes: [
    "id_lote",
    "id_compra",
    "id_linea_compra",
    "id_owner",
    "sku_proveedor",
    "sku_interno",
    "descripcion",
    "cantidad_comprada",
    "costo_unitario_bruto",
    "creado_en",
  ],
  Ventas: [
    "id_venta",
    "date",
    "canal",
    "total_bruto",
    "notas",
    "pago_terminal",
    "meses_sin_intereses_3",
    "tasa_comision_terminal",
    "comision_terminal_total",
    "total_neto_despues_comision",
    "creado_en",
  ],
  LineasVenta: [
    "id_linea_venta",
    "id_venta",
    "id_lote",
    "sku",
    "cantidad",
    "precio_unitario_bruto",
    "descuento_bruto",
    "ingreso_bruto",
    "comision_terminal",
    "ingreso_neto",
    "costo_ventas_bruto",
    "utilidad_bruta",
  ],
  RepartosUtilidad: [
    "id_reparto",
    "id_venta",
    "id_owner",
    "participacion_utilidad_bruta",
    "status",
    "creado_en",
  ],
  MovimientosCapital: ["id_movimiento", "id_owner", "tipo", "monto", "referencia_id", "fecha", "creado_en"],
};

function getSpreadsheetId() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }
  return spreadsheetId;
}

export function getSheetsClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  }
  if (!clientSecret) {
    throw new Error("Missing GOOGLE_OAUTH_CLIENT_SECRET");
  }
  if (!refreshToken) {
    throw new Error("Missing GOOGLE_OAUTH_REFRESH_TOKEN");
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({
    refresh_token: refreshToken,
    scope: SCOPES.join(" "),
  });

  return google.sheets({ version: "v4", auth });
}

export async function appendRow(sheetName: string, row: (string | number)[]) {
  const spreadsheetId = getSpreadsheetId();

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

export async function getAllRows(sheetName: string) {
  const spreadsheetId = getSpreadsheetId();

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const values = res.data.values ?? [];
  if (!values.length) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const [headers, ...rows] = values;
  return { headers: headers as string[], rows: rows as string[][] };
}

export async function bootstrapLedgerSheets() {
  const spreadsheetId = getSpreadsheetId();
  const sheets = getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingNames = new Set(
    (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((title): title is string => Boolean(title))
  );

  const missing = Object.keys(LEDGER_SCHEMA).filter((name) => !existingNames.has(name));

  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({
          addSheet: {
            properties: { title },
          },
        })),
      },
    });
  }

  for (const [sheetName, headers] of Object.entries(LEDGER_SCHEMA)) {
    const firstRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    const current = firstRow.data.values?.[0] ?? [];

    if (current.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
      continue;
    }

    const mergedHeaders = [...current];
    let changed = false;
    for (const header of headers) {
      if (!mergedHeaders.includes(header)) {
        mergedHeaders.push(header);
        changed = true;
      }
    }

    if (changed) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [mergedHeaders] },
      });
    }
  }

  return {
    createdSheets: missing,
    initializedHeaders: Object.keys(LEDGER_SCHEMA),
  };
}
