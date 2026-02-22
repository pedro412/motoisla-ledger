const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  owner: {
    findUnique: vi.fn(),
    delete: vi.fn(),
  },
  lot: { findMany: vi.fn() },
  saleLine: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn() },
  sale: { deleteMany: vi.fn() },
  purchase: { count: vi.fn(), deleteMany: vi.fn() },
  capitalMovement: { count: vi.fn(), deleteMany: vi.fn() },
  profitSplit: { count: vi.fn(), deleteMany: vi.fn() },
  user: { count: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);

import { DELETE as deleteInvestor } from "@/app/api/investors/[id]/route";

describe("investor hard delete api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        profitSplit: { deleteMany: vi.fn() },
        saleLine: { deleteMany: vi.fn() },
        sale: { deleteMany: vi.fn() },
        capitalMovement: { deleteMany: vi.fn() },
        purchase: { deleteMany: vi.fn() },
        user: { deleteMany: vi.fn() },
        owner: { delete: vi.fn() },
      };
      await cb(tx);
      return tx;
    });
  });

  it("returns 403 when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR" });
    authzMocks.isAdmin.mockReturnValue(false);

    const res = await deleteInvestor(
      new Request("http://localhost/api/investors/inv_1", { method: "DELETE", body: JSON.stringify({ confirmText: "BORRAR" }) }),
      { params: { id: "inv_1" } },
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when there are mixed sales", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN" });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", name: "Inv", type: "INVESTOR" });
    dbMocks.lot.findMany.mockResolvedValue([{ id: "lot_1" }]);
    dbMocks.saleLine.findMany.mockResolvedValue([{ id: "sl_1", saleId: "sale_1" }]);
    dbMocks.saleLine.findFirst.mockResolvedValue({ id: "sl_other", saleId: "sale_1" });

    const res = await deleteInvestor(
      new Request("http://localhost/api/investors/inv_1", { method: "DELETE", body: JSON.stringify({ confirmText: "BORRAR" }) }),
      { params: { id: "inv_1" } },
    );
    expect(res.status).toBe(409);
  });

  it("deletes investor data when confirmation is valid", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN" });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", name: "Inv", type: "INVESTOR" });
    dbMocks.lot.findMany.mockResolvedValue([{ id: "lot_1" }]);
    dbMocks.saleLine.findMany.mockResolvedValue([{ id: "sl_1", saleId: "sale_1" }]);
    dbMocks.saleLine.findFirst.mockResolvedValue(null);
    dbMocks.purchase.count.mockResolvedValue(2);
    dbMocks.capitalMovement.count.mockResolvedValue(3);
    dbMocks.profitSplit.count.mockResolvedValue(4);
    dbMocks.user.count.mockResolvedValue(1);

    const res = await deleteInvestor(
      new Request("http://localhost/api/investors/inv_1", { method: "DELETE", body: JSON.stringify({ confirmText: "BORRAR" }) }),
      { params: { id: "inv_1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.ownerId).toBe("inv_1");
    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });
});
