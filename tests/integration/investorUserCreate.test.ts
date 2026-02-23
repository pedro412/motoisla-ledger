const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  owner: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), create: vi.fn() },
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);

import { POST as createInvestorUser } from "@/app/api/users/investor/route";

describe("investor user creation api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);
    const res = await createInvestorUser(new Request("http://localhost/api/users/investor", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(false);
    const res = await createInvestorUser(
      new Request("http://localhost/api/users/investor", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", username: "invuser", password: "12345678" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when owner is not investor", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "motoisla", type: "MOTOISLA", name: "MotoIsla" });

    const res = await createInvestorUser(
      new Request("http://localhost/api/users/investor", {
        method: "POST",
        body: JSON.stringify({ ownerId: "motoisla", username: "invuser", password: "12345678" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when username already exists", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", type: "INVESTOR", name: "Lic" });
    dbMocks.user.findUnique.mockResolvedValue({ id: "u_existing" });

    const res = await createInvestorUser(
      new Request("http://localhost/api/users/investor", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", username: "invuser", password: "12345678" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("creates investor user successfully", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", type: "INVESTOR", name: "Lic" });
    dbMocks.user.findUnique.mockResolvedValue(null);
    dbMocks.user.create.mockResolvedValue({ id: "u_new", username: "invuser", ownerId: "inv_1" });

    const res = await createInvestorUser(
      new Request("http://localhost/api/users/investor", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", username: "invuser", password: "12345678" }),
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.username).toBe("invuser");
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });
});
