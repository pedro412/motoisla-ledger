const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
  isInvestor: vi.fn(),
  isStaff: vi.fn(),
  canAccessOwner: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  owner: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  lot: {
    findMany: vi.fn(),
  },
  saleLine: {
    groupBy: vi.fn(),
  },
}));

const capitalMocks = vi.hoisted(() => ({
  transferProfitToCapital: vi.fn(),
}));
const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/capital", () => capitalMocks);
vi.mock("@/lib/audit", () => auditMocks);

import { GET as investorsGet } from "@/app/api/investors/route";
import { GET as lotsGet } from "@/app/api/lots/route";
import { POST as transferProfitPost } from "@/app/api/capital/transfer-profit/route";

describe("role flows integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin can list all investors", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isInvestor.mockReturnValue(false);
    dbMocks.owner.findMany.mockResolvedValue([
      { id: "inv_1", name: "Inv 1", type: "INVESTOR", initialCapital: 1000, createdAt: new Date("2026-01-01") },
      { id: "inv_2", name: "Inv 2", type: "INVESTOR", initialCapital: 2000, createdAt: new Date("2026-01-02") },
    ]);

    const res = await investorsGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.investors).toHaveLength(2);
    expect(dbMocks.owner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "INVESTOR" },
      }),
    );
  });

  it("investor is scoped to own investor record", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isInvestor.mockReturnValue(true);
    dbMocks.owner.findMany.mockResolvedValue([
      { id: "inv_1", name: "Inv 1", type: "INVESTOR", initialCapital: 1000, createdAt: new Date("2026-01-01") },
    ]);

    const res = await investorsGet();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.investors).toHaveLength(1);
    expect(json.investors[0].id).toBe("inv_1");
    expect(dbMocks.owner.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "INVESTOR", id: "inv_1" },
      }),
    );
  });

  it("investor lots endpoint ignores requested owner and forces own scope", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isInvestor.mockReturnValue(true);
    dbMocks.lot.findMany.mockResolvedValue([
      {
        id: "lot_1",
        ownerId: "inv_1",
        supplierSku: "SKU-1",
        description: "Producto",
        unitCostGross: 100,
        qtyBought: 5,
      },
    ]);
    dbMocks.saleLine.groupBy.mockResolvedValue([{ lotId: "lot_1", _sum: { qty: 1 } }]);

    const req = new Request("http://localhost/api/lots?ownerId=inv_2");
    const res = await lotsGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.lots).toHaveLength(1);
    expect(json.lots[0].ownerId).toBe("inv_1");
    expect(dbMocks.lot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "inv_1" },
      }),
    );
  });

  it("investor can transfer own profit to capital", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isStaff.mockReturnValue(false);
    authzMocks.canAccessOwner.mockReturnValue(true);
    capitalMocks.transferProfitToCapital.mockResolvedValue({
      ownerId: "inv_1",
      availableProfit: 500,
      transferredAmount: 200,
      currentCapitalAfter: 1200,
    });

    const req = new Request("http://localhost/api/capital/transfer-profit", {
      method: "POST",
      body: JSON.stringify({ ownerId: "inv_1", amount: 200 }),
    });

    const res = await transferProfitPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.transferredAmount).toBe(200);
    expect(capitalMocks.transferProfitToCapital).toHaveBeenCalledWith("inv_1", 200, "u_inv");
  });
});
