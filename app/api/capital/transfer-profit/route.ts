import { NextResponse } from "next/server";
import { OwnerType } from "@prisma/client";
import { z } from "zod";
import { transferProfitToCapital } from "@/lib/capital";
import { db } from "@/lib/db";

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
  const investor = await db.owner.findFirst({
    where: { type: OwnerType.INVESTOR },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return investor?.id ?? "INVESTOR_ID";
}
