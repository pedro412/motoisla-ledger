import { NextResponse } from "next/server";
import { z } from "zod";
import { getAllRows } from "@/lib/sheets";
import { transferProfitToCapital } from "@/lib/capital";

const BodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const ownerId = parsed.data.ownerId ?? (await resolveInvestorOwnerId());
    const result = await transferProfitToCapital(ownerId, parsed.data.amount);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function resolveInvestorOwnerId() {
  const investors = await getAllRows("Inversionistas");
  const idx = indexMap(investors.headers);
  return (
    investors.rows.find((row) => String(row[idx.tipo] ?? "").toUpperCase() === "INVESTOR")?.[idx.id_inversionista] ??
    process.env.DEFAULT_INVESTOR_ID ??
    "INVESTOR_ID"
  );
}

function indexMap(headers: string[]) {
  const m: Record<string, number> = {};
  headers.forEach((h, i) => {
    m[h] = i;
  });
  return m;
}
