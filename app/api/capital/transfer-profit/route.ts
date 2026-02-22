import { NextResponse } from "next/server";
import { AuditEntity, OwnerType } from "@prisma/client";
import { z } from "zod";
import { transferProfitToCapital } from "@/lib/capital";
import { db } from "@/lib/db";
import { canAccessOwner, getSessionUser, isStaff } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidateUiPaths } from "@/lib/revalidate";

const BodySchema = z.object({
  ownerId: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
    }

    const ownerId = parsed.data.ownerId ?? user.ownerId ?? (await resolveInvestorOwnerId());
    if (!isStaff(user) && !canAccessOwner(user, ownerId)) {
      return NextResponse.json({ ok: false, error: "No autorizado para este inversionista" }, { status: 403 });
    }

    const result = await transferProfitToCapital(ownerId, parsed.data.amount, user.id);
    await logAudit({
      actorUserId: user.id,
      action: "capital.profit_transferred",
      entity: AuditEntity.CAPITAL_MOVEMENT,
      entityId: result.ownerId,
      payload: {
        ownerId: result.ownerId,
        requestedAmount: parsed.data.amount ?? null,
        transferredAmount: result.transferredAmount,
        availableProfit: result.availableProfit,
        currentCapitalAfter: result.currentCapitalAfter,
      },
    });
    revalidateUiPaths(["/dashboard", "/auditoria"]);
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
