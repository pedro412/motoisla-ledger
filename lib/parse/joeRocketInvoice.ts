import type { ParsedLine } from "@/lib/parse/ls2Invoice";

export function parseJoeRocketInvoiceText(raw: string): ParsedLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const itemBlocks = extractItemBlocks(lines);
  const priceBlocks = extractPriceBlocks(lines);

  if (!itemBlocks.length) {
    throw new Error("No se detectaron productos en formato Joe Rocket.");
  }
  if (!priceBlocks.length) {
    throw new Error("No se detectaron precios en formato Joe Rocket.");
  }
  if (itemBlocks.length !== priceBlocks.length) {
    throw new Error(
      `Factura Joe Rocket inconsistente: productos=${itemBlocks.length}, precios=${priceBlocks.length}.`,
    );
  }

  return itemBlocks.map((item, idx) => {
    const price = priceBlocks[idx];
    return {
      supplierSku: item.supplierSku,
      qty: price.qty,
      unit: item.unit,
      description: item.description,
      unitPriceNet: price.unitPriceNet,
      lineTotalNet: price.lineTotalNet,
    };
  });
}

function extractItemBlocks(lines: string[]) {
  const out: Array<{ unit: string; supplierSku: string; description: string }> = [];
  let sectionStart = 0;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const codeLine = lines[i];
    const skuLine = lines[i + 1];

    const codeMatch = codeLine.match(/^(\d{3,4})\s+([A-Z0-9]{2,6})$/);
    if (!codeMatch) continue;
    if (!isSkuLine(skuLine)) continue;

    const chunk = lines.slice(sectionStart, i);
    const description = normalizeDescription(chunk);
    if (!description) {
      throw new Error(`No description found for Joe Rocket SKU ${skuLine}`);
    }

    out.push({
      unit: codeMatch[2],
      supplierSku: skuLine,
      description,
    });

    sectionStart = i + 2;
    i += 1;
  }

  return out;
}

function extractPriceBlocks(lines: string[]) {
  const out: Array<{ qty: number; unitPriceNet: number; lineTotalNet: number }> = [];
  for (const line of lines) {
    const m = line.match(/^(\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})$/);
    if (!m) continue;

    out.push({
      qty: parseMoney(m[1]),
      unitPriceNet: parseMoney(m[2]),
      lineTotalNet: parseMoney(m[4]),
    });
  }
  return out;
}

function normalizeDescription(chunk: string[]) {
  const relevant = chunk.filter(isDescriptionLine);
  return relevant.join(" ").replace(/\s+/g, " ").trim();
}

function isDescriptionLine(line: string) {
  if (!line) return false;
  if (!/[A-Za-z]/.test(line)) return false;
  if (/^Item Code:?$/i.test(line)) return false;
  if (/^MOTO BOUTIQUE/i.test(line)) return false;
  if (/^BLVD\./i.test(line)) return false;
  if (/^Telefonos?:/i.test(line)) return false;
  if (/^Correo:/i.test(line)) return false;
  if (/^www\./i.test(line)) return false;
  if (/^Número de/i.test(line)) return false;
  if (/^Fecha de documento/i.test(line)) return false;
  if (/^Moneda:/i.test(line)) return false;
  if (/^RFC$/i.test(line)) return false;
  if (/^Página$/i.test(line)) return false;
  if (/^\d+\/\d+$/.test(line)) return false;
  if (/^Su referencia$/i.test(line)) return false;
  if (/^Su contacto$/i.test(line)) return false;
  if (/^Dirección de entrega$/i.test(line)) return false;
  if (/^Unidad de$/i.test(line)) return false;
  if (/^medida$/i.test(line)) return false;
  if (/^Impuesto$/i.test(line)) return false;
  if (/^%$/.test(line)) return false;
  if (/^Descripción Cantidad Precio Total$/i.test(line)) return false;
  if (/^Descripción Cantidad Precio$/i.test(line)) return false;
  if (/^Fin de validez/i.test(line)) return false;
  if (/^Plazo de pago/i.test(line)) return false;
  if (/^Subtotal de la oferta/i.test(line)) return false;
  if (/^Total antes del impuesto/i.test(line)) return false;
  if (/^Importe total/i.test(line)) return false;
  if (/^Indicador de/i.test(line)) return false;
  if (/^C\d+\s+\d+/.test(line)) return false;
  if (/^Arrastre:/i.test(line)) return false;
  if (/^OFERTA DE VENTAS$/i.test(line)) return false;
  if (/^[A-Z]{3,5}\d{4,}$/.test(line)) return false;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) return false;
  if (/^\d{1,3}(?:,\d{3})*\.\d{2}\s+[A-Z]{3}$/.test(line)) return false;
  if (/^CL\d+$/i.test(line)) return false;
  if (/^MX$/i.test(line)) return false;
  if (/^Original$/i.test(line)) return false;
  if (/^Igual que dirección de factura$/i.test(line)) return false;
  if (/^KARINA RIVERA BARRA$/i.test(line)) return false;
  if (/^PAOLA SOLIS$/i.test(line)) return false;
  if (/^Francisco villa/i.test(line)) return false;
  if (/^CIUDAD DEL CARMEN/i.test(line)) return false;
  if (/^San Luis Potosí/i.test(line)) return false;
  if (/^Blvd\. Antonio Rocha/i.test(line)) return false;
  if (/^Tierra Blanca$/i.test(line)) return false;
  if (/^Costos adicionales/i.test(line)) return false;
  if (/^Clase de expedición/i.test(line)) return false;

  return line.includes("/");
}

function isSkuLine(line: string) {
  return /^[A-Z0-9][A-Z0-9-]{2,}$/.test(line);
}

function parseMoney(s: string) {
  return Number(String(s).replace(/,/g, ""));
}
