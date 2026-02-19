import "server-only";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getServiceAccountJSON() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!b64) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  }

  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json) as { client_email: string; private_key: string };
}

export function getSheetsClient() {
  const sa = getServiceAccountJSON();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: SCOPES,
  });

  return google.sheets({ version: "v4", auth });
}

export async function appendRow(sheetName: string, row: (string | number)[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

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
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID");
  }

  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });

  const values = res.data.values ?? [];
  if (!values.length) {
    return { headers: [] as string[], rows: [] as string[][] };
  }

  const [headers, ...rows] = values;
  return { headers: headers as string[], rows: rows as string[][] };
}
