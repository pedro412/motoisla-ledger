const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isStaff: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  purchase: {
    findUnique: vi.fn(),
  },
  lot: {
    findMany: vi.fn(),
  },
  saleLine: {
    count: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);

import { POST as cancelPurchasePost } from "@/app/api/purchases/[id]/cancel/route";

describe("purchase cancel api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        purchase: { update: vi.fn() },
        lot: { updateMany: vi.fn() },
        capitalMovement: { create: vi.fn() },
      };
      await cb(tx);
      return tx;
    });
  });

  it("returns 401 when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);

    const res = await cancelPurchasePost(new Request("http://localhost", { method: "POST", body: "{}" }), {
      params: { id: "pur_1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isStaff.mockReturnValue(false);

    const res = await cancelPurchasePost(new Request("http://localhost", { method: "POST", body: "{}" }), {
      params: { id: "pur_1" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when purchase does not exist", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.purchase.findUnique.mockResolvedValue(null);

    const res = await cancelPurchasePost(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Error factura" }) }),
      { params: { id: "pur_1" } },
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 when purchase already has sales", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.purchase.findUnique.mockResolvedValue({
      id: "pur_1",
      ownerId: "inv_1",
      totalGross: 200,
      date: new Date("2026-01-01"),
      status: "ACTIVE",
    });
    dbMocks.lot.findMany.mockResolvedValue([{ id: "lot_1" }]);
    dbMocks.saleLine.count.mockResolvedValue(1);

    const res = await cancelPurchasePost(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Error factura" }) }),
      { params: { id: "pur_1" } },
    );
    expect(res.status).toBe(409);
  });

  it("cancels purchase successfully when it has no sales", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.purchase.findUnique.mockResolvedValue({
      id: "pur_1",
      ownerId: "inv_1",
      totalGross: 200,
      date: new Date("2026-01-01"),
      status: "ACTIVE",
    });
    dbMocks.lot.findMany.mockResolvedValue([{ id: "lot_1" }]);
    dbMocks.saleLine.count.mockResolvedValue(0);

    const res = await cancelPurchasePost(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ reason: "Captura incorrecta" }) }),
      { params: { id: "pur_1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.purchaseId).toBe("pur_1");
    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });
});
