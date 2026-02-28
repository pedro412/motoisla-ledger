import { NextResponse } from "next/server";
import { AuditEntity } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const ResetInvestorPasswordSchema = z.object({
  ownerId: z.string().trim().min(1),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede cambiar passwords de inversionistas" }, { status: 403 });

    const body = ResetInvestorPasswordSchema.parse(await req.json());
    const owner = await db.owner.findUnique({
      where: { id: body.ownerId },
      select: { id: true, type: true, name: true },
    });
    if (!owner || owner.type !== "INVESTOR") {
      return NextResponse.json({ ok: false, error: "Inversionista no encontrado" }, { status: 404 });
    }

    const targetUser = await db.user.findFirst({
      where: { ownerId: body.ownerId, role: "INVERSIONISTA" },
      select: { id: true, username: true, ownerId: true },
      orderBy: { createdAt: "asc" },
    });
    if (!targetUser) {
      return NextResponse.json({ ok: false, error: "Este inversionista no tiene usuario creado" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const updatedUser = await db.user.update({
      where: { id: targetUser.id },
      data: { passwordHash },
      select: { id: true, username: true, ownerId: true },
    });

    await logAudit({
      actorUserId: user.id,
      action: "investor.user_password_reset",
      entity: AuditEntity.OWNER,
      entityId: owner.id,
      payload: {
        ownerId: owner.id,
        ownerName: owner.name,
        targetUserId: updatedUser.id,
        username: updatedUser.username,
      },
    });

    return NextResponse.json({
      ok: true,
      userId: updatedUser.id,
      username: updatedUser.username,
      ownerId: updatedUser.ownerId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
