import { isBlockedPathForInvestor } from "@/lib/rbacRoutes";

describe("rbac routes policy", () => {
  it("blocks sensitive pages and apis for investor role", () => {
    expect(isBlockedPathForInvestor("/purchases/new")).toBe(true);
    expect(isBlockedPathForInvestor("/sales/new")).toBe(true);
    expect(isBlockedPathForInvestor("/investors")).toBe(true);
    expect(isBlockedPathForInvestor("/api/purchases")).toBe(true);
    expect(isBlockedPathForInvestor("/api/sales")).toBe(true);
    expect(isBlockedPathForInvestor("/api/investors")).toBe(true);
    expect(isBlockedPathForInvestor("/api/capital/reconcile")).toBe(true);
    expect(isBlockedPathForInvestor("/api/health/db")).toBe(true);
  });

  it("allows read-oriented pages for investor role", () => {
    expect(isBlockedPathForInvestor("/dashboard")).toBe(false);
    expect(isBlockedPathForInvestor("/inventario")).toBe(false);
    expect(isBlockedPathForInvestor("/auditoria")).toBe(false);
    expect(isBlockedPathForInvestor("/api/lots")).toBe(false);
    expect(isBlockedPathForInvestor("/api/capital/transfer-profit")).toBe(false);
  });
});
