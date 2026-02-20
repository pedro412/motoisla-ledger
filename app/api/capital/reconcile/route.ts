import { NextResponse } from "next/server";
import { reconcileCapitalMovementsFromLedger } from "@/lib/capital";

export async function POST() {
  try {
    const result = await reconcileCapitalMovementsFromLedger();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
