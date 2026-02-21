import { canAccessOwner, isAdmin, isInvestor, isStaff, type SessionUser } from "@/lib/authz";

function buildUser(overrides: Partial<SessionUser>): SessionUser {
  return {
    id: "u1",
    role: "OPERADOR",
    ownerId: null,
    ...overrides,
  };
}

describe("authz unit", () => {
  it("detects role helpers", () => {
    const admin = buildUser({ role: "ADMIN" });
    const operador = buildUser({ role: "OPERADOR" });
    const inversionista = buildUser({ role: "INVERSIONISTA", ownerId: "inv_1" });

    expect(isAdmin(admin)).toBe(true);
    expect(isStaff(admin)).toBe(true);
    expect(isInvestor(admin)).toBe(false);

    expect(isAdmin(operador)).toBe(false);
    expect(isStaff(operador)).toBe(true);
    expect(isInvestor(operador)).toBe(false);

    expect(isAdmin(inversionista)).toBe(false);
    expect(isStaff(inversionista)).toBe(false);
    expect(isInvestor(inversionista)).toBe(true);
  });

  it("allows owner access for staff and scoped access for investor", () => {
    const admin = buildUser({ role: "ADMIN" });
    const operador = buildUser({ role: "OPERADOR" });
    const inversionista = buildUser({ role: "INVERSIONISTA", ownerId: "inv_1" });
    const inversionistaSinOwner = buildUser({ role: "INVERSIONISTA", ownerId: null });

    expect(canAccessOwner(admin, "inv_2")).toBe(true);
    expect(canAccessOwner(operador, "inv_2")).toBe(true);

    expect(canAccessOwner(inversionista, "inv_1")).toBe(true);
    expect(canAccessOwner(inversionista, "inv_2")).toBe(false);
    expect(canAccessOwner(inversionistaSinOwner, "inv_1")).toBe(false);
  });
});
