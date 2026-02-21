import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { uid } from "@/lib/ids";

const UpdateCapitalSchema = z.object({
  nuevoCapitalInicial: z.number().nonnegative(),
  motivo: z.string().optional(),
});

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const body = UpdateCapitalSchema.parse(await req.json());
    const ownerId = ctx.params.id;

    const owner = await db.owner.findUnique({
      where: { id: ownerId },
      select: { id: true, initialCapital: true },
    });
    if (!owner) {
      return NextResponse.json({ ok: false, error: `Owner no encontrado: ${ownerId}` }, { status: 404 });
    }

    const current = Number(owner.initialCapital);
    const next = body.nuevoCapitalInicial;
    const delta = round2(next - current);

    await db.$transaction(async (tx) => {
      await tx.owner.update({
        where: { id: ownerId },
        data: { initialCapital: dec(next) },
      });

      if (delta !== 0) {
        await tx.capitalMovement.create({
          data: {
            id: uid("cap"),
            ownerId,
            type: "AJUSTE_CAPITAL_INICIAL",
            amount: dec(delta),
            referenceType: "ADJUSTMENT",
            referenceId: uid("adj"),
            date: new Date(),
            notes: body.motivo ?? "Ajuste capital inicial",
          },
        });
      }
    });

    return NextResponse.json({ ok: true, ownerId, delta });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number) {
  return new Prisma.Decimal(round2(n));
}
