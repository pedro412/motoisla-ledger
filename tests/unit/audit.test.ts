import { AuditEntity } from "@prisma/client";
import { logAudit } from "@/lib/audit";

describe("audit helper", () => {
  it("writes expected payload with and without actor", async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const writer = {
      auditLog: { create },
    };

    await logAudit(
      {
        action: "sale.created",
        entity: AuditEntity.SALE,
        entityId: "sale_1",
        actorUserId: "user_1",
        payload: { ownerId: "inv_1", total: 1200 },
      },
      writer as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user_1",
        action: "sale.created",
        entity: AuditEntity.SALE,
        entityId: "sale_1",
        payload: { ownerId: "inv_1", total: 1200 },
      },
    });

    await logAudit(
      {
        action: "capital.reconciled",
        entity: AuditEntity.CAPITAL_MOVEMENT,
        entityId: "bulk",
      },
      writer as never,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        actorUserId: null,
        action: "capital.reconciled",
        entity: AuditEntity.CAPITAL_MOVEMENT,
        entityId: "bulk",
        payload: undefined,
      },
    });
  });
});
