const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);

import { POST as createMovement } from "@/app/api/investors/[id]/capital/movements/route";
import { PATCH as patchInitialCapital } from "@/app/api/investors/[id]/capital/route";

describe("capital external movements api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.$transaction.mockImplementation(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        owner: { findUnique: vi.fn() },
        capitalMovement: { aggregate: vi.fn(), create: vi.fn() },
      };
      return cb(tx);
    });
  });

  it("returns 401 when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);
    const res = await createMovement(new Request("http://localhost", { method: "POST", body: "{}" }), {
      params: { id: "inv_1" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(false);
    const res = await createMovement(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ type: "APORTE_CAPITAL", amount: 100 }),
      }),
      { params: { id: "inv_1" } },
    );
    expect(res.status).toBe(403);
  });

  it("returns 409 when withdraw exceeds current capital", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.$transaction.mockImplementationOnce(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        owner: {
          findUnique: vi.fn().mockResolvedValue({ id: "inv_1", name: "Lic", type: "INVESTOR", initialCapital: 100 }),
        },
        capitalMovement: {
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } }),
          create: vi.fn(),
        },
      };
      return cb(tx);
    });

    const res = await createMovement(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ type: "RETIRO_CAPITAL", amount: 150 }),
      }),
      { params: { id: "inv_1" } },
    );
    expect(res.status).toBe(409);
  });

  it("creates aporte movement successfully", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.$transaction.mockImplementationOnce(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = {
        owner: {
          findUnique: vi.fn().mockResolvedValue({ id: "inv_1", name: "Lic", type: "INVESTOR", initialCapital: 100 }),
        },
        capitalMovement: {
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _sum: { amount: 0 } })
            .mockResolvedValueOnce({ _sum: { amount: 0 } }),
          create: vi.fn(),
        },
      };
      return cb(tx);
    });

    const res = await createMovement(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ type: "APORTE_CAPITAL", amount: 100, motivo: "Aporte enero" }),
      }),
      { params: { id: "inv_1" } },
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.currentCapitalAfter).toBe(200);
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });

  it("deprecated endpoint for initial capital returns 410", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);

    const res = await patchInitialCapital(
      new Request("http://localhost", {
        method: "PATCH",
        body: JSON.stringify({ nuevoCapitalInicial: 999 }),
      }),
      { params: { id: "inv_1" } },
    );
    expect(res.status).toBe(410);
  });
});
