const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isStaff: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  sale: {
    findUnique: vi.fn(),
  },
  profitSplit: {
    count: vi.fn(),
  },
  saleLine: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);

import { DELETE as deleteSale } from "@/app/api/sales/[id]/route";

describe("sale delete api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        capitalMovement: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        profitSplit: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
        saleLine: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        sale: { delete: vi.fn() },
      };
      await cb(tx);
      return tx;
    });
  });

  it("returns 401 when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "BORRAR" }),
      }),
      { params: { id: "sale_1" } },
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not staff", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isStaff.mockReturnValue(false);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "BORRAR" }),
      }),
      { params: { id: "sale_1" } },
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when confirmation text is invalid", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "NO" }),
      }),
      { params: { id: "sale_1" } },
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when sale does not exist", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.sale.findUnique.mockResolvedValue(null);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "BORRAR" }),
      }),
      { params: { id: "sale_1" } },
    );

    expect(res.status).toBe(404);
  });

  it("returns 409 when sale has transferred profit", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.sale.findUnique.mockResolvedValue({
      id: "sale_1",
      date: new Date("2026-02-01T12:00:00Z"),
      totalGross: 1000,
      terminalFeeTotal: 20,
      totalNetAfterFee: 980,
    });
    dbMocks.profitSplit.count.mockResolvedValue(1);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "BORRAR" }),
      }),
      { params: { id: "sale_1" } },
    );

    expect(res.status).toBe(409);
  });

  it("deletes sale and restores numbers when valid", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.sale.findUnique.mockResolvedValue({
      id: "sale_1",
      date: new Date("2026-02-01T12:00:00Z"),
      totalGross: 1000,
      terminalFeeTotal: 20,
      totalNetAfterFee: 980,
    });
    dbMocks.profitSplit.count.mockResolvedValue(0);
    dbMocks.saleLine.findMany.mockResolvedValue([
      { id: "sl_1", cogsGross: 500, profitGross: 100, lot: { ownerId: "inv_1" } },
      { id: "sl_2", cogsGross: 300, profitGross: 80, lot: { ownerId: "inv_1" } },
    ]);

    const res = await deleteSale(
      new Request("http://localhost/api/sales/sale_1", {
        method: "DELETE",
        body: JSON.stringify({ confirmText: "BORRAR", reason: "Carga errónea" }),
      }),
      { params: { id: "sale_1" } },
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.saleId).toBe("sale_1");
    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });
});
