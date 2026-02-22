import { parseEdgeInvoiceText } from "@/lib/parse/edgeInvoice";
import { parseLS2InvoiceText, type ParsedLine } from "@/lib/parse/ls2Invoice";

export type InvoiceFormat = "LS2" | "EDGE";

export function parseInvoiceByFormat(rawText: string, format: InvoiceFormat): ParsedLine[] {
  if (format === "EDGE") return parseEdgeInvoiceText(rawText);
  return parseLS2InvoiceText(rawText);
}
