import { NextResponse } from "next/server";
import { AuditEntity } from "@prisma/client";
import { reconcileCapitalMovementsFromLedger } from "@/lib/capital";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const result = await reconcileCapitalMovementsFromLedger(user.id);
    await logAudit({
      actorUserId: user.id,
      action: "capital.reconciled",
      entity: AuditEntity.CAPITAL_MOVEMENT,
      entityId: "bulk",
      payload: result,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
