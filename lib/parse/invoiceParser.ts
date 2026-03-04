import { parseEdgeInvoiceText } from "@/lib/parse/edgeInvoice";
import { parseJoeRocketInvoiceText } from "@/lib/parse/joeRocketInvoice";
import { parseLS2InvoiceText, type ParsedLine } from "@/lib/parse/ls2Invoice";

export type InvoiceFormat = "LS2" | "EDGE" | "JOE_ROCKET";

export function parseInvoiceByFormat(rawText: string, format: InvoiceFormat): ParsedLine[] {
  if (format === "EDGE") return parseEdgeInvoiceText(rawText);
  if (format === "JOE_ROCKET") return parseJoeRocketInvoiceText(rawText);
  return parseLS2InvoiceText(rawText);
}
