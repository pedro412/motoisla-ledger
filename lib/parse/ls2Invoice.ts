export type ParsedLine = {
  supplierSku: string;
  qty: number;
  unit: string;
  description: string;
  satProductKey?: string;
  pedimento?: string;
  unitPriceNet?: number;
  lineTotalNet: number;
};

export function parseLS2InvoiceText(raw: string): ParsedLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out: ParsedLine[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const s = lines[i];
    const m = s.match(/^\*\*\s+([0-9A-Za-z-]+)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9]+)\s+(.+)$/);
    if (!m) {
      continue;
    }

    const supplierSku = m[1];
    const qty = Number(m[2]);
    const unit = m[3];
    const description = m[4];

    let satProductKey: string | undefined;
    let pedimento: string | undefined;

    if (lines[i + 1]?.includes("CLAVE PRODUCTO")) {
      const k = lines[i + 1].match(/CLAVE PRODUCTO:\s*([0-9]+)/);
      const p = lines[i + 1].match(/CLAVE PEDIMENTO:\s*(.+)$/);
      if (k) satProductKey = k[1];
      if (p) pedimento = p[1].trim();
      i += 1;
    } else if (lines[i + 2]?.includes("CLAVE PRODUCTO")) {
      const k = lines[i + 2].match(/CLAVE PRODUCTO:\s*([0-9]+)/);
      const p = lines[i + 2].match(/CLAVE PEDIMENTO:\s*(.+)$/);
      if (k) satProductKey = k[1];
      if (p) pedimento = p[1].trim();
      i += 2;
    }

    let unitPriceNet: number | undefined;
    let lineTotalNet: number | undefined;

    for (let j = 1; j <= 4; j += 1) {
      const priceLine = lines[i + j];
      if (!priceLine) continue;
      const pm = priceLine.match(/^([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/);
      if (pm) {
        unitPriceNet = parseMoney(pm[1]);
        lineTotalNet = parseMoney(pm[2]);
        i += j;
        break;
      }
    }

    if (lineTotalNet == null) {
      throw new Error(`No price line found for SKU ${supplierSku}`);
    }

    out.push({
      supplierSku,
      qty,
      unit,
      description,
      satProductKey,
      pedimento,
      unitPriceNet,
      lineTotalNet,
    });
  }

  return out;
}

function parseMoney(s: string) {
  return Number(s.replace(/,/g, ""));
}
