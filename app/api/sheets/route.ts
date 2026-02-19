import { NextResponse } from "next/server";
import { getAllRows } from "@/lib/sheets";

export async function GET() {
  try {
    const purchases = await getAllRows("Purchases");
    return NextResponse.json({ ok: true, purchasesRows: purchases.rows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
