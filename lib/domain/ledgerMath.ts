export type SaleLineInput = {
  qty: number;
  unitPriceGross: number;
  discountGross: number;
  lotUnitCostGross: number;
};

export type SaleLineComputed = {
  grossRevenue: number;
  terminalFee: number;
  netRevenue: number;
  cogsGross: number;
  profitGross: number;
};

export function getCommissionRate(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return 0;
  return threeMonthsNoInterest ? 0.0558 : 0.02;
}

export function computeSaleLine(input: SaleLineInput, commissionRate: number): SaleLineComputed {
  const grossRevenue = round2(input.qty * input.unitPriceGross - input.discountGross);
  const terminalFee = round2(grossRevenue * commissionRate);
  const netRevenue = round2(grossRevenue - terminalFee);
  const cogsGross = round2(input.qty * input.lotUnitCostGross);
  const profitGross = round2(netRevenue - cogsGross);
  return { grossRevenue, terminalFee, netRevenue, cogsGross, profitGross };
}

export function validateRequestedQtyByLot(
  availableByLot: Map<string, number>,
  requestedByLot: Map<string, number>,
) {
  for (const [lotId, requestedQty] of requestedByLot.entries()) {
    const available = availableByLot.get(lotId);
    if (available == null) {
      throw new Error(`Lot not found: ${lotId}`);
    }
    if (requestedQty > available) {
      throw new Error(
        `Cantidad excedida para lote ${lotId}: solicitado=${round6(requestedQty)} disponible=${round6(available)}`
      );
    }
  }
}

export function computeCurrentCapital(initialCapital: number, movements: number[]) {
  return round2(initialCapital + movements.reduce((acc, n) => acc + n, 0));
}

export function getAvailableProfitToTransfer(accruedProfit: number, transferredProfit: number) {
  return round2(Math.max(0, accruedProfit - transferredProfit));
}

export function splitProfit50_50(profit: number) {
  const investor = round2(profit * 0.5);
  const motoIsla = round2(profit * 0.5);
  return { investor, motoIsla };
}

export function computeOpexDeduction(grossRevenue: number, opexRate: number): number {
  return round2(grossRevenue * opexRate * 0.5);
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round6(n: number) {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
