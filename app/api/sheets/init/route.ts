import { NextResponse } from "next/server";
import { bootstrapLedgerSheets } from "@/lib/sheets";

export async function POST() {
  try {
    const result = await bootstrapLedgerSheets();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
