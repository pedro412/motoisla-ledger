import {
  computeCurrentCapital,
  computeSaleLine,
  getAvailableProfitToTransfer,
  getCommissionRate,
  splitProfit50_50,
  validateRequestedQtyByLot,
} from "@/lib/domain/ledgerMath";

describe("ledgerMath unit", () => {
  it("applies 0%, 2% and 5.58% commission rates correctly", () => {
    expect(getCommissionRate(false, false)).toBe(0);
    expect(getCommissionRate(true, false)).toBe(0.02);
    expect(getCommissionRate(true, true)).toBe(0.0558);
  });

  it("computes sale line with commission and profit", () => {
    const out = computeSaleLine(
      { qty: 2, unitPriceGross: 100, discountGross: 10, lotUnitCostGross: 60 },
      0.02,
    );
    expect(out.grossRevenue).toBe(190);
    expect(out.terminalFee).toBe(3.8);
    expect(out.netRevenue).toBe(186.2);
    expect(out.cogsGross).toBe(120);
    expect(out.profitGross).toBe(66.2);
  });

  it("validates stock by lot and throws when exceeded", () => {
    const available = new Map([
      ["lotA", 5],
      ["lotB", 10],
    ]);
    const requestedOk = new Map([
      ["lotA", 2],
      ["lotB", 9],
    ]);
    expect(() => validateRequestedQtyByLot(available, requestedOk)).not.toThrow();

    const requestedBad = new Map([["lotA", 6]]);
    expect(() => validateRequestedQtyByLot(available, requestedBad)).toThrow("Cantidad excedida para lote lotA");
  });

  it("computes capital and transferable profit", () => {
    expect(computeCurrentCapital(30000, [-5000, 1000, 250])).toBe(26250);
    expect(getAvailableProfitToTransfer(5000, 1200)).toBe(3800);
  });

  it("splits profit 50/50", () => {
    const split = splitProfit50_50(101.23);
    expect(split.investor).toBe(50.62);
    expect(split.motoIsla).toBe(50.62);
  });
});
