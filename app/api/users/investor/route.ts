import { NextResponse } from "next/server";
import { AuditEntity, UserRole } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const CreateInvestorUserSchema = z.object({
  ownerId: z.string().min(1),
  username: z.string().trim().min(3).max(50).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(100),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede crear usuarios de inversionista" }, { status: 403 });

    const body = CreateInvestorUserSchema.parse(await req.json());
    const owner = await db.owner.findUnique({
      where: { id: body.ownerId },
      select: { id: true, type: true, name: true },
    });
    if (!owner || owner.type !== "INVESTOR") {
      return NextResponse.json({ ok: false, error: "Inversionista no encontrado" }, { status: 404 });
    }

    const existingByUsername = await db.user.findUnique({
      where: { username: body.username },
      select: { id: true },
    });
    if (existingByUsername) {
      return NextResponse.json({ ok: false, error: `Username ya en uso: ${body.username}` }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const created = await db.user.create({
      data: {
        username: body.username,
        passwordHash,
        role: UserRole.INVERSIONISTA,
        ownerId: owner.id,
        name: body.name?.trim() || body.username,
        email: body.email?.trim() || `${body.username}@local.motoisla`,
      },
      select: {
        id: true,
        username: true,
        ownerId: true,
      },
    });

    await logAudit({
      actorUserId: user.id,
      action: "investor.user_created",
      entity: AuditEntity.OWNER,
      entityId: owner.id,
      payload: {
        ownerId: owner.id,
        ownerName: owner.name,
        createdUserId: created.id,
        username: created.username,
      },
    });

    return NextResponse.json({ ok: true, userId: created.id, username: created.username, ownerId: created.ownerId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
