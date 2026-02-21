import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { uid } from "@/lib/ids";
import { parseLS2InvoiceText } from "@/lib/parse/ls2Invoice";
import { getOwnerCapitalSnapshot } from "@/lib/capital";
import { allocateTaxByLines } from "@/lib/tax";
import { PurchaseImportSchema } from "@/types/schemas";
import { db } from "@/lib/db";

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
    if (!parsed.length) {
      throw new Error("Factura inválida o formato no soportado: no se detectaron líneas de productos.");
    }
    const lineNets = parsed.map((line) => line.lineTotalNet);
    const taxes = allocateTaxByLines(lineNets, body.taxTotal, body.taxRate);

    await db.$transaction(async (tx) => {
      await tx.purchase.create({
        data: {
          id: purchaseId,
          ownerId: body.defaultOwnerId,
          date: new Date(body.date),
          supplier: body.supplier,
          invoiceRef: body.invoiceRef,
          subtotalNet: dec(body.subtotalNet),
          taxTotal: dec(body.taxTotal),
          totalGross: dec(body.totalGross),
          taxRate: new Prisma.Decimal(body.taxRate),
          rawDocText: body.rawText,
          createdAt: new Date(createdAt),
          updatedAt: new Date(createdAt),
        },
      });

      for (let i = 0; i < parsed.length; i += 1) {
        const p = parsed[i];
        const lineTax = taxes[i];
        const lineGross = round2(p.lineTotalNet + lineTax);

        const purchaseLineId = uid("pl");
        const lotId = uid("lot");
        const unitCostNetExact = p.lineTotalNet / p.qty;
        const unitCostGrossExact = lineGross / p.qty;

        await tx.purchaseLine.create({
          data: {
            id: purchaseLineId,
            purchaseId,
            lineNo: i + 1,
            supplierSku: p.supplierSku,
            unit: p.unit,
            descriptionRaw: p.description,
            qty: dec6(p.qty),
            lineTotalNet: dec(p.lineTotalNet),
            satProductKey: p.satProductKey ?? null,
            pedimento: p.pedimento ?? null,
            lineTaxAllocated: dec(lineTax),
            lineTotalGross: dec(lineGross),
            unitCostNetExact: dec6(unitCostNetExact),
            unitCostGrossExact: dec6(unitCostGrossExact),
          },
        });

        await tx.lot.create({
          data: {
            id: lotId,
            purchaseId,
            purchaseLineId,
            ownerId: body.defaultOwnerId,
            supplierSku: p.supplierSku,
            internalSku: "",
            description: p.description,
            qtyBought: dec6(p.qty),
            unitCostGross: dec6(unitCostGrossExact),
            createdAt: new Date(createdAt),
          },
        });
      }

      await tx.capitalMovement.create({
        data: {
          id: uid("cap"),
          ownerId: body.defaultOwnerId,
          type: "COMPRA",
          amount: dec(-body.totalGross),
          referenceType: "PURCHASE",
          referenceId: purchaseId,
          date: new Date(body.date),
          notes: rawDocId,
        },
      });
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

function dec(n: number) {
  return new Prisma.Decimal(round2(n));
}

function dec6(n: number) {
  return new Prisma.Decimal(round6(n));
}
