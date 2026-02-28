const authzMocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  isAdmin: vi.fn(),
}));

const dbMocks = vi.hoisted(() => ({
  owner: { findUnique: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn() },
}));

const auditMocks = vi.hoisted(() => ({
  logAudit: vi.fn(),
}));

const bcryptMocks = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock("@/lib/authz", () => authzMocks);
vi.mock("@/lib/db", () => ({ db: dbMocks }));
vi.mock("@/lib/audit", () => auditMocks);
vi.mock("bcryptjs", () => ({
  default: bcryptMocks,
}));

import { POST as resetInvestorPassword } from "@/app/api/users/investor/reset-password/route";

describe("investor user password reset api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bcryptMocks.hash.mockResolvedValue("hashed-password");
  });

  it("returns 401 when unauthenticated", async () => {
    authzMocks.getSessionUser.mockResolvedValue(null);

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", { method: "POST", body: "{}" }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_op", role: "OPERADOR", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(false);

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", password: "12345678" }),
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 400 when payload is invalid", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "", password: "123" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when owner does not exist", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue(null);

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_missing", password: "12345678" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when owner is not investor", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "motoisla", type: "MOTOISLA", name: "MotoIsla" });

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "motoisla", password: "12345678" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 when investor has no user", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", type: "INVESTOR", name: "Lic" });
    dbMocks.user.findFirst.mockResolvedValue(null);

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", password: "12345678" }),
      }),
    );

    expect(res.status).toBe(404);
  });

  it("resets investor password successfully", async () => {
    authzMocks.getSessionUser.mockResolvedValue({ id: "u_admin", role: "ADMIN", ownerId: null });
    authzMocks.isAdmin.mockReturnValue(true);
    dbMocks.owner.findUnique.mockResolvedValue({ id: "inv_1", type: "INVESTOR", name: "Lic" });
    dbMocks.user.findFirst.mockResolvedValue({ id: "u_inv", username: "invuser", ownerId: "inv_1" });
    dbMocks.user.update.mockResolvedValue({ id: "u_inv", username: "invuser", ownerId: "inv_1" });

    const res = await resetInvestorPassword(
      new Request("http://localhost/api/users/investor/reset-password", {
        method: "POST",
        body: JSON.stringify({ ownerId: "inv_1", password: "NuevaPassword123!" }),
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.username).toBe("invuser");
    expect(json.ownerId).toBe("inv_1");
    expect(bcryptMocks.hash).toHaveBeenCalledWith("NuevaPassword123!", 12);
    expect(dbMocks.user.update).toHaveBeenCalledWith({
      where: { id: "u_inv" },
      data: { passwordHash: "hashed-password" },
      select: { id: true, username: true, ownerId: true },
    });
    expect(auditMocks.logAudit).toHaveBeenCalled();
  });
});
