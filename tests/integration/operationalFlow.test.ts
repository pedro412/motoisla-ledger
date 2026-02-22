const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isStaff: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  lot: { findMany: vi.fn() },
  saleLine: { groupBy: vi.fn() },
}));

const capitalMocks = vi.hoisted(() => ({
  getOwnerCapitalSnapshot: vi.fn(),
  resolveProfitOwners: vi.fn(),
}));

const parseMocks = vi.hoisted(() => ({
  parseInvoiceByFormat: vi.fn(),
}));

const taxMocks = vi.hoisted(() => ({
  allocateTaxByLines: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/capital", () => capitalMocks);
vi.mock("@/lib/parse/invoiceParser", () => parseMocks);
vi.mock("@/lib/tax", () => taxMocks);
vi.mock("@/lib/audit", () => auditMocks);

import { POST as purchasesPost } from "@/app/api/purchases/route";
import { POST as salesPost } from "@/app/api/sales/route";

describe("operational flow integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_staff", role: "OPERADOR", ownerId: null });
    authzMocks.isStaff.mockReturnValue(true);
    dbMocks.$transaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        purchase: { create: vi.fn() },
        purchaseLine: { create: vi.fn() },
        lot: { create: vi.fn() },
        capitalMovement: { create: vi.fn() },
        sale: { create: vi.fn() },
        saleLine: { create: vi.fn() },
        profitSplit: { create: vi.fn() },
      };
      await cb(tx);
      return tx;
    });
  });

  it("purchase flow persists purchase, lot, capital movement and audit", async () => {
    capitalMocks.getOwnerCapitalSnapshot.mockResolvedValue({ currentCapital: 50000 });
    parseMocks.parseInvoiceByFormat.mockReturnValue([
      {
        supplierSku: "SKU-1",
        unit: "PZA",
        description: "Producto 1",
        qty: 2,
        lineTotalNet: 100,
        satProductKey: null,
        pedimento: null,
      },
    ]);
    taxMocks.allocateTaxByLines.mockReturnValue([16]);

    const req = new Request("http://localhost/api/purchases", {
      method: "POST",
      body: JSON.stringify({
        supplier: "Proveedor X",
        invoiceFormat: "LS2",
        date: "2026-02-01",
        invoiceRef: "FAC-123",
        subtotalNet: 100,
        taxTotal: 16,
        totalGross: 116,
        taxRate: 0.16,
        rawText: "Factura de prueba con longitud suficiente",
        defaultOwnerId: "inv_1",
      }),
    });

    const res = await purchasesPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u_staff",
        action: "purchase.created",
      }),
      expect.anything(),
    );
  });

  it("sale flow persists sale, lines, splits, capital movement and audit", async () => {
    capitalMocks.resolveProfitOwners.mockResolvedValue({ motoIslaOwnerId: "motoisla", investorOwnerId: "inv_1" });
    dbMocks.lot.findMany.mockResolvedValue([
      { id: "lot_1", ownerId: "inv_1", unitCostGross: 100, supplierSku: "SKU-1", qtyBought: 10 },
    ]);
    dbMocks.saleLine.groupBy.mockResolvedValue([]);

    const req = new Request("http://localhost/api/sales", {
      method: "POST",
      body: JSON.stringify({
        date: "2026-02-02",
        channel: "STORE",
        notes: "",
        terminalPayment: true,
        threeMonthsNoInterest: false,
        lines: [{ lotId: "lot_1", sku: "SKU-1", qty: 2, unitPriceGross: 150, discountGross: 0 }],
      }),
    });

    const res = await salesPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.totalGross).toBe(300);
    expect(dbMocks.$transaction).toHaveBeenCalledTimes(1);
    expect(auditMocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u_staff",
        action: "sale.created",
      }),
      expect.anything(),
    );
  });
});
