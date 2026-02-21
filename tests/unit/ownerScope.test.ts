import type { SessionUser } from "@/lib/authz";
import { canQueryOwner, resolveOwnerScope } from "@/lib/ownerScope";

function user(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: "u",
    role: "OPERADOR",
    ownerId: null,
    ...overrides,
  };
}

describe("owner scope", () => {
  it("forces investor scope to own ownerId", () => {
    const investor = user({ role: "INVERSIONISTA", ownerId: "inv_a" });
    expect(resolveOwnerScope(investor, "inv_b")).toBe("inv_a");
    expect(resolveOwnerScope(investor, null)).toBe("inv_a");
    expect(canQueryOwner(investor, "inv_a")).toBe(true);
    expect(canQueryOwner(investor, "inv_b")).toBe(false);
  });

  it("allows staff to use requested scope", () => {
    const admin = user({ role: "ADMIN" });
    const operador = user({ role: "OPERADOR" });
    expect(resolveOwnerScope(admin, "inv_b")).toBe("inv_b");
    expect(resolveOwnerScope(operador, "inv_c")).toBe("inv_c");
    expect(canQueryOwner(admin, "inv_x")).toBe(true);
    expect(canQueryOwner(operador, "inv_x")).toBe(true);
  });
});
