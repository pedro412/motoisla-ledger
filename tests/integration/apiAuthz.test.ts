const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
  isStaff: vi.fn(),
  canAccessOwner: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);

import { POST as purchasesPost } from "@/app/api/purchases/route";
import { POST as salesRecalculatePost } from "@/app/api/sales/recalculate/route";
import { POST as investorsPost } from "@/app/api/investors/route";
import { POST as transferProfitPost } from "@/app/api/capital/transfer-profit/route";

describe("api authz integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 on purchases when user is not authenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);

    const res = await purchasesPost(new Request("http://localhost/api/purchases", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 on purchases when user is not staff", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isStaff.mockReturnValue(false);

    const res = await purchasesPost(new Request("http://localhost/api/purchases", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
  });

  it("returns 401 on sales recalculate when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);

    const res = await salesRecalculatePost();
    expect(res.status).toBe(401);
  });

  it("returns 403 on sales recalculate when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(false);

    const res = await salesRecalculatePost();
    expect(res.status).toBe(403);
  });

  it("returns 403 on investor creation when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(false);

    const res = await investorsPost(new Request("http://localhost/api/investors", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 on transfer-profit when investor tries another owner", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_inv", role: "INVERSIONISTA", ownerId: "inv_1" });
    authzMocks.isStaff.mockReturnValue(false);
    authzMocks.canAccessOwner.mockReturnValue(false);

    const res = await transferProfitPost(
      new Request("http://localhost/api/capital/transfer-profit", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_2", amount: 100 }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
