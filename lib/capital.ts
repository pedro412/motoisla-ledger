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

export async function reconcileCapitalMovementsFromLedger() {
  return db.$transaction(async (tx) => {
    await tx.capitalMovement.deleteMany({
      where: { type: { in: [CapitalMovementType.COMPRA, CapitalMovementType.VENTA_COSTO] } },
    });

    const purchases = await tx.purchase.findMany({
      select: { id: true, ownerId: true, totalGross: true, date: true },
    });

    if (purchases.length > 0) {
      await tx.capitalMovement.createMany({
        data: purchases.map((p) => ({
          id: uid("cap"),
          ownerId: p.ownerId,
          type: CapitalMovementType.COMPRA,
          amount: new Prisma.Decimal(0).sub(p.totalGross),
          referenceType: "PURCHASE",
          referenceId: p.id,
          date: p.date,
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
      compras: purchases.length,
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
  const aggregate = await db.capitalMovement.aggregate({
    where: { ownerId },
    _sum: { amount: true },
  });

  const flow = toNumber(aggregate._sum.amount);
  return {
    initialCapital,
    capitalFlow: flow,
    currentCapital: round2(initialCapital + flow),
  };
}

export async function appendCapitalMovement(params: {
  ownerId: string;
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
      type,
      amount: new Prisma.Decimal(round2(params.amount)),
      referenceType,
      referenceId: params.referenceId,
      date: new Date(params.date),
      notes: params.notes ?? null,
    },
  });
}

export async function transferProfitToCapital(ownerId: string, requestedAmount?: number): Promise<ProfitTransferResult> {
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

async function getOwnerAccruedProfit(ownerId: string) {
  const aggregate = await db.profitSplit.aggregate({
    where: { ownerId },
    _sum: { profitShareGross: true },
  });
  return round2(toNumber(aggregate._sum.profitShareGross));
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
