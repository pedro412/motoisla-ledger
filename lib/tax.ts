export function allocateTaxByLines(lineNets: number[], taxTotal: number, taxRate = 0.16) {
  const rounded = lineNets.map((n) => round2(n * taxRate));
  const sum = rounded.reduce((a, b) => a + b, 0);
  const delta = round2(taxTotal - sum);

  const idx =
    lineNets
      .map((v, i) => ({ v, i }))
      .sort((a, b) => b.v - a.v)[0]?.i ?? 0;

  const allocated = [...rounded];
  if (delta !== 0) {
    allocated[idx] = round2(allocated[idx] + delta);
  }

  const finalSum = round2(allocated.reduce((a, b) => a + b, 0));
  if (finalSum !== round2(taxTotal)) {
    throw new Error(`Tax allocation mismatch: ${finalSum} != ${taxTotal}`);
  }

  return allocated;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
