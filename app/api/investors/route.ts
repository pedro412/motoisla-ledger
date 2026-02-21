import { NextResponse } from "next/server";
import { AuditEntity, OwnerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import { getSessionUser, isAdmin, isInvestor } from "@/lib/authz";
import { logAudit } from "@/lib/audit";

const CreateInvestorSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  tipo: z.enum(["INVESTOR", "MOTOISLA"]).default("INVESTOR"),
  capitalInicial: z.number().nonnegative().default(0),
});

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });

    const owners = await db.owner.findMany({
      where: {
        type: OwnerType.INVESTOR,
        ...(isInvestor(user) ? { id: user.ownerId ?? "__none__" } : {}),
      },
      select: {
        id: true,
        name: true,
        type: true,
        initialCapital: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      investors: owners.map((o) => ({
        id: o.id,
        nombre: o.name,
        tipo: o.type,
        capitalInicial: Number(o.initialCapital),
        creadoEn: o.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede crear inversionistas" }, { status: 403 });

    const body = CreateInvestorSchema.parse(await req.json());
    const existing = await db.owner.findUnique({ where: { id: body.id }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ ok: false, error: `Ya existe owner ${body.id}` }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      await tx.owner.create({
        data: {
          id: body.id,
          name: body.nombre,
          type: body.tipo,
          initialCapital: dec(body.capitalInicial),
        },
      });

      if (body.capitalInicial > 0) {
        await tx.capitalMovement.create({
          data: {
            id: uid("cap"),
            ownerId: body.id,
            createdByUserId: user.id,
            updatedByUserId: user.id,
            type: "CAPITAL_INICIAL",
            amount: dec(body.capitalInicial),
            referenceType: "ADJUSTMENT",
            referenceId: uid("adj"),
            date: new Date(),
            notes: "Alta inversionista",
          },
        });
      }

      await logAudit(
        {
          actorUserId: user.id,
          action: "owner.created",
          entity: AuditEntity.OWNER,
          entityId: body.id,
          payload: {
            ownerId: body.id,
            nombre: body.nombre,
            tipo: body.tipo,
            capitalInicial: body.capitalInicial,
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, ownerId: body.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function dec(n: number) {
  return new Prisma.Decimal(Math.round((n + Number.EPSILON) * 100) / 100);
}
