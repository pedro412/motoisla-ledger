import type { ParsedLine } from "@/lib/parse/ls2Invoice";

export function parseEdgeInvoiceText(raw: string): ParsedLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const out: ParsedLine[] = [];
  let i = 0;

  while (i < lines.length) {
    const start = lines[i].match(/^\[([^\]]+)\]\s*(.*)$/);
    if (!start) {
      i += 1;
      continue;
    }

    const supplierSku = start[1].trim();
    const descriptionParts: string[] = [];
    if (start[2]) descriptionParts.push(start[2].trim());

    let satProductKey: string | undefined;
    let qty: number | undefined;
    let unit: string | undefined;
    let unitPriceNet: number | undefined;
    let lineTotalNet: number | undefined;

    i += 1;
    while (i < lines.length) {
      const detail = lines[i];
      const dm = detail.match(
        /^(\d+)\s+([\d,]+(?:\.\d+)?)\s+([A-Za-z0-9]+)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([A-Za-z0-9]+)\s+IVA\((\d+)%\)\s+\$\s*([\d,]+(?:\.\d+)?)$/i,
      );
      if (dm) {
        satProductKey = dm[1];
        qty = parseMoney(dm[2]);
        unit = dm[3];
        unitPriceNet = parseMoney(dm[4]);
        lineTotalNet = parseMoney(dm[8]);
        i += 1;
        break;
      }

      if (!detail.startsWith("Código") && !detail.startsWith("Producto") && !detail.startsWith("Descripción")) {
        descriptionParts.push(detail);
      }
      i += 1;
    }

    if (lineTotalNet == null || qty == null || unit == null) {
      throw new Error(`No price line found for EDGE SKU ${supplierSku}`);
    }

    out.push({
      supplierSku,
      qty,
      unit,
      description: descriptionParts.join(" ").replace(/\s+/g, " ").trim(),
      satProductKey,
      lineTotalNet,
      unitPriceNet,
    });
  }

  return out;
}

function parseMoney(s: string) {
  return Number(String(s).replace(/,/g, ""));
}
