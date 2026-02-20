import { NextResponse } from "next/server";
import { z } from "zod";
import { uid } from "@/lib/ids";
import { parseLS2InvoiceText } from "@/lib/parse/ls2Invoice";
import { appendRow } from "@/lib/sheets";
import { appendCapitalMovement, getOwnerCapitalSnapshot } from "@/lib/capital";
import { allocateTaxByLines } from "@/lib/tax";
import { PurchaseImportSchema } from "@/types/schemas";

export async function POST(req: Request) {
  try {
    const body = PurchaseImportSchema.parse(await req.json());

    const purchaseId = uid("pur");
    const rawDocId = uid("raw");
    const createdAt = new Date().toISOString();
    const capital = await getOwnerCapitalSnapshot(body.defaultOwnerId);
    if (body.totalGross > capital.currentCapital) {
      throw new Error(
        `Capital insuficiente para ${body.defaultOwnerId}. Disponible=${round2(capital.currentCapital)} requerido=${round2(body.totalGross)}`
      );
    }

    const parsed = parseLS2InvoiceText(body.rawText);
    const lineNets = parsed.map((line) => line.lineTotalNet);
    const taxes = allocateTaxByLines(lineNets, body.taxTotal, body.taxRate);

    await appendRow("Compras", [
      purchaseId,
      body.date,
      body.supplier,
      body.invoiceRef,
      body.subtotalNet,
      body.taxTotal,
      body.totalGross,
      body.taxRate,
      rawDocId,
      createdAt,
    ]);

    for (let i = 0; i < parsed.length; i += 1) {
      const p = parsed[i];
      const lineTax = taxes[i];
      const lineGross = round2(p.lineTotalNet + lineTax);

      const purchaseLineId = uid("pl");
      const lotId = uid("lot");
      const unitCostNetExact = p.lineTotalNet / p.qty;
      const unitCostGrossExact = lineGross / p.qty;

      await appendRow("LineasCompra", [
        purchaseLineId,
        purchaseId,
        i + 1,
        p.supplierSku,
        p.unit,
        p.description,
        p.qty,
        p.lineTotalNet,
        p.satProductKey ?? "",
        p.pedimento ?? "",
        lineTax,
        lineGross,
        round6(unitCostNetExact),
        round6(unitCostGrossExact),
      ]);

      await appendRow("Lotes", [
        lotId,
        purchaseId,
        purchaseLineId,
        body.defaultOwnerId,
        p.supplierSku,
        "",
        p.description,
        p.qty,
        round6(unitCostGrossExact),
        createdAt,
      ]);
    }

    await appendCapitalMovement({
      ownerId: body.defaultOwnerId,
      type: "COMPRA",
      amount: -body.totalGross,
      referenceId: purchaseId,
      date: body.date,
    });

    return NextResponse.json({ ok: true, purchaseId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
