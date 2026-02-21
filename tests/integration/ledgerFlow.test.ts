import {
  computeCurrentCapital,
  computeSaleLine,
  getAvailableProfitToTransfer,
  getCommissionRate,
  splitProfit50_50,
  validateRequestedQtyByLot,
} from "@/lib/domain/ledgerMath";

describe("ledger full flow integration (domain-level)", () => {
  it("runs purchase -> sale -> profit split -> transfer profit to capital", () => {
    const initialCapital = 30000;

    const purchaseTotal = 10000;
    const capitalAfterPurchase = computeCurrentCapital(initialCapital, [-purchaseTotal]);
    expect(capitalAfterPurchase).toBe(20000);

    const availableByLot = new Map([["lot-1", 20]]);
    const requestedByLot = new Map([["lot-1", 5]]);
    validateRequestedQtyByLot(availableByLot, requestedByLot);

    const rate = getCommissionRate(true, false);
    const line = computeSaleLine(
      {
        qty: 5,
        unitPriceGross: 350,
        discountGross: 50,
        lotUnitCostGross: 200,
      },
      rate,
    );

    expect(line.grossRevenue).toBe(1700);
    expect(line.terminalFee).toBe(34);
    expect(line.netRevenue).toBe(1666);
    expect(line.cogsGross).toBe(1000);
    expect(line.profitGross).toBe(666);

    const capitalAfterSaleCostReturn = computeCurrentCapital(capitalAfterPurchase, [line.cogsGross]);
    expect(capitalAfterSaleCostReturn).toBe(21000);

    const split = splitProfit50_50(line.profitGross);
    expect(split.investor).toBe(333);
    expect(split.motoIsla).toBe(333);

    const availableProfit = getAvailableProfitToTransfer(split.investor, 0);
    expect(availableProfit).toBe(333);

    const capitalAfterTransfer = computeCurrentCapital(capitalAfterSaleCostReturn, [availableProfit]);
    expect(capitalAfterTransfer).toBe(21333);
  });
});
