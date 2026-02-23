import { NextResponse } from "next/server";
import { AuditEntity, CapitalMovementType, OwnerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { revalidateUiPaths } from "@/lib/revalidate";

const CreateCapitalMovementSchema = z.object({
  type: z.enum(["APORTE_CAPITAL", "RETIRO_CAPITAL"]),
  amount: z.number().positive(),
  motivo: z.string().trim().max(300).optional(),
});

export async function POST(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede mover capital externo" }, { status: 403 });

    const ownerId = String(ctx.params.id || "");
    if (!ownerId) return NextResponse.json({ ok: false, error: "ownerId requerido" }, { status: 400 });
    const body = CreateCapitalMovementSchema.parse(await req.json().catch(() => ({})));

    const result = await db.$transaction(async (tx) => {
      const owner = await tx.owner.findUnique({
        where: { id: ownerId },
        select: { id: true, name: true, type: true, initialCapital: true },
      });
      if (!owner || owner.type !== OwnerType.INVESTOR) {
        throw new Error("OWNER_NOT_FOUND_OR_NOT_INVESTOR");
      }

      const [sumAll, sumInitialAdjust] = await Promise.all([
        tx.capitalMovement.aggregate({
          where: { ownerId },
          _sum: { amount: true },
        }),
        tx.capitalMovement.aggregate({
          where: {
            ownerId,
            type: { in: ["CAPITAL_INICIAL", "AJUSTE_CAPITAL_INICIAL"] },
          },
          _sum: { amount: true },
        }),
      ]);
      const totalFlow = toNumber(sumAll._sum.amount);
      const initialAdjustFlow = toNumber(sumInitialAdjust._sum.amount);
      const capitalBefore = round2(toNumber(owner.initialCapital) + (totalFlow - initialAdjustFlow));
      const requestedAmount = round2(body.amount);
      const movementType =
        body.type === "APORTE_CAPITAL" ? CapitalMovementType.APORTE_CAPITAL : CapitalMovementType.RETIRO_CAPITAL;

      if (movementType === CapitalMovementType.RETIRO_CAPITAL && requestedAmount > capitalBefore) {
        throw new Error(`INSUFFICIENT_CAPITAL:${capitalBefore}`);
      }

      const signedAmount = movementType === CapitalMovementType.APORTE_CAPITAL ? requestedAmount : -requestedAmount;
      const capitalAfter = round2(capitalBefore + signedAmount);

      await tx.capitalMovement.create({
        data: {
          id: uid("cap"),
          ownerId,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          type: movementType,
          amount: dec(signedAmount),
          referenceType: "ADJUSTMENT",
          referenceId: uid("adj"),
          date: new Date(),
          notes: body.motivo || null,
        },
      });

      await logAudit(
        {
          actorUserId: user.id,
          action: movementType === CapitalMovementType.APORTE_CAPITAL ? "capital.external_added" : "capital.external_withdrawn",
          entity: AuditEntity.CAPITAL_MOVEMENT,
          entityId: ownerId,
          payload: {
            ownerId,
            ownerName: owner.name,
            movementType,
            amount: requestedAmount,
            motivo: body.motivo ?? null,
            currentCapitalBefore: capitalBefore,
            currentCapitalAfter: capitalAfter,
          },
        },
        tx,
      );

      return {
        ownerId,
        movementType,
        amount: requestedAmount,
        currentCapitalAfter: capitalAfter,
      };
    });

    revalidateUiPaths(["/dashboard", "/investors", "/auditoria"]);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    if (error instanceof Error && error.message === "OWNER_NOT_FOUND_OR_NOT_INVESTOR") {
      return NextResponse.json({ ok: false, error: "Inversionista no encontrado" }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_CAPITAL:")) {
      const available = Number(error.message.split(":")[1] || 0);
      return NextResponse.json(
        { ok: false, error: `No se puede retirar más de lo disponible. Capital actual: ${round2(available)}` },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number) {
  return new Prisma.Decimal(round2(n));
}
