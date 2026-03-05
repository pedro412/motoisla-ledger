import { CapitalMovementType, OwnerType, Prisma } from "@prisma/client";
import { uid } from "@/lib/ids";
import { db } from "@/lib/db";

type ProfitTransferResult = {
  ownerId: string;
  availableProfit: number;
  transferredAmount: number;
  currentCapitalAfter: number;
};

type MovementKind = CapitalMovementType | "UTILIDAD_A_CAPITAL";

export async function reconcileCapitalMovementsFromLedger(actorUserId?: string) {
  return db.$transaction(async (tx) => {
    await tx.capitalMovement.deleteMany({
      where: { type: { in: [CapitalMovementType.COMPRA, CapitalMovementType.REVERSA_COMPRA, CapitalMovementType.VENTA_COSTO] } },
    });

    const purchases = await tx.purchase.findMany({
      select: { id: true, ownerId: true, totalGross: true, date: true, status: true, cancelledAt: true },
    });

    const activePurchases = purchases.filter((p) => p.status === "ACTIVE");
    const cancelledPurchases = purchases.filter((p) => p.status === "CANCELLED");

    if (activePurchases.length > 0) {
      await tx.capitalMovement.createMany({
        data: activePurchases.map((p) => ({
          id: uid("cap"),
          ownerId: p.ownerId,
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
          type: CapitalMovementType.COMPRA,
          amount: new Prisma.Decimal(0).sub(p.totalGross),
          referenceType: "PURCHASE",
          referenceId: p.id,
          date: p.date,
          notes: "reconcile",
        })),
      });
    }

    if (cancelledPurchases.length > 0) {
      await tx.capitalMovement.createMany({
        data: cancelledPurchases.map((p) => ({
          id: uid("cap"),
          ownerId: p.ownerId,
          createdByUserId: actorUserId ?? null,
          updatedByUserId: actorUserId ?? null,
          type: CapitalMovementType.REVERSA_COMPRA,
          amount: p.totalGross,
          referenceType: "PURCHASE",
          referenceId: p.id,
          date: p.cancelledAt ?? new Date(),
          notes: "reconcile",
        })),
      });
    }

    const grouped = await tx.saleLine.groupBy({
      by: ["saleId", "lotId"],
      _sum: { cogsGross: true },
    });
    const lots = await tx.lot.findMany({
      where: { id: { in: grouped.map((g) => g.lotId) } },
      select: { id: true, ownerId: true },
    });
    const ownerByLot = new Map(lots.map((l) => [l.id, l.ownerId]));

    if (grouped.length > 0) {
      await tx.capitalMovement.createMany({
        data: grouped
          .filter((g) => ownerByLot.has(g.lotId))
          .map((g) => ({
            id: uid("cap"),
            ownerId: ownerByLot.get(g.lotId) as string,
            createdByUserId: actorUserId ?? null,
            updatedByUserId: actorUserId ?? null,
            type: CapitalMovementType.VENTA_COSTO,
            amount: g._sum.cogsGross ?? new Prisma.Decimal(0),
            referenceType: "SALE",
            referenceId: g.saleId,
            date: new Date(),
            notes: "reconcile",
          })),
      });
    }

    return {
      total: purchases.length + grouped.length,
      compras: activePurchases.length,
      reversasCompra: cancelledPurchases.length,
      ventasCosto: grouped.length,
    };
  });
}

export async function getOwnerInitialCapital(ownerId: string) {
  const owner = await db.owner.findUnique({
    where: { id: ownerId },
    select: { initialCapital: true },
  });
  if (!owner) {
    throw new Error(`No existe ${ownerId} en owners`);
  }
  return toNumber(owner.initialCapital);
}

export async function getOwnerCapitalSnapshot(ownerId: string) {
  const initialCapital = await getOwnerInitialCapital(ownerId);
  const [aggregateAll, aggregateInitialAdjust] = await Promise.all([
    db.capitalMovement.aggregate({
      where: { ownerId },
      _sum: { amount: true },
    }),
    db.capitalMovement.aggregate({
      where: {
        ownerId,
        type: { in: [CapitalMovementType.CAPITAL_INICIAL, CapitalMovementType.AJUSTE_CAPITAL_INICIAL] },
      },
      _sum: { amount: true },
    }),
  ]);

  const totalFlow = toNumber(aggregateAll._sum.amount);
  const initialAdjustFlow = toNumber(aggregateInitialAdjust._sum.amount);
  const flow = round2(totalFlow - initialAdjustFlow);

  return {
    initialCapital,
    capitalFlow: flow,
    currentCapital: round2(initialCapital + flow),
  };
}

export function isInitialOrAdjustMovementType(type: CapitalMovementType) {
  return type === CapitalMovementType.CAPITAL_INICIAL || type === CapitalMovementType.AJUSTE_CAPITAL_INICIAL;
}

async function getOwnerAccruedProfit(ownerId: string) {
  const aggregate = await db.profitSplit.aggregate({
    where: { ownerId },
    _sum: { profitShareGross: true, opexDeduction: true },
  });
  return round2(toNumber(aggregate._sum.profitShareGross) - toNumber(aggregate._sum.opexDeduction));
}

export async function appendCapitalMovement(params: {
  ownerId: string;
  actorUserId?: string;
  type: MovementKind;
  amount: number;
  referenceId: string;
  date: string;
  notes?: string;
}) {
  const type = params.type === "UTILIDAD_A_CAPITAL" ? CapitalMovementType.UTILIDAD_A_CAPITAL : params.type;
  const referenceType = inferReferenceType(type);

  await db.capitalMovement.create({
    data: {
      id: uid("cap"),
      ownerId: params.ownerId,
      createdByUserId: params.actorUserId ?? null,
      updatedByUserId: params.actorUserId ?? null,
      type,
      amount: new Prisma.Decimal(round2(params.amount)),
      referenceType,
      referenceId: params.referenceId,
      date: new Date(params.date),
      notes: params.notes ?? null,
    },
  });
}

export async function transferProfitToCapital(
  ownerId: string,
  requestedAmount?: number,
  actorUserId?: string,
): Promise<ProfitTransferResult> {
  const [capital, accruedProfit, transferredProfit] = await Promise.all([
    getOwnerCapitalSnapshot(ownerId),
    getOwnerAccruedProfit(ownerId),
    getOwnerTransferredProfit(ownerId),
  ]);

  const availableProfit = round2(accruedProfit - transferredProfit);
  if (availableProfit <= 0) {
    throw new Error(`No hay utilidad disponible para transferir para ${ownerId}`);
  }

  const amount = requestedAmount == null ? availableProfit : round2(requestedAmount);
  if (amount <= 0) {
    throw new Error("El monto a transferir debe ser mayor a 0");
  }
  if (amount > availableProfit) {
    throw new Error(`Monto excede utilidad disponible: disponible=${availableProfit} solicitado=${amount}`);
  }

  await appendCapitalMovement({
    ownerId,
    actorUserId,
    type: "UTILIDAD_A_CAPITAL",
    amount,
    referenceId: uid("trf"),
    date: new Date().toISOString().slice(0, 10),
  });

  return {
    ownerId,
    availableProfit,
    transferredAmount: amount,
    currentCapitalAfter: round2(capital.currentCapital + amount),
  };
}

export async function resolveProfitOwners() {
  const [investor, motoIsla] = await Promise.all([
    db.owner.findFirst({
      where: { type: OwnerType.INVESTOR },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
    db.owner.findFirst({
      where: { type: OwnerType.MOTOISLA },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!investor) {
    throw new Error("No hay owner tipo INVESTOR configurado");
  }
  if (!motoIsla) {
    throw new Error("No hay owner tipo MOTOISLA configurado");
  }

  return { investorOwnerId: investor.id, motoIslaOwnerId: motoIsla.id };
}

function inferReferenceType(type: CapitalMovementType) {
  if (type === CapitalMovementType.COMPRA) return "PURCHASE";
  if (type === CapitalMovementType.VENTA_COSTO) return "SALE";
  return "TRANSFER";
}

async function getOwnerTransferredProfit(ownerId: string) {
  const aggregate = await db.capitalMovement.aggregate({
    where: {
      ownerId,
      type: CapitalMovementType.UTILIDAD_A_CAPITAL,
    },
    _sum: { amount: true },
  });
  return round2(toNumber(aggregate._sum.amount));
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
