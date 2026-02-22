import { parseEdgeInvoiceText } from "@/lib/parse/edgeInvoice";

describe("edge invoice parser", () => {
  it("parses EDGE lines with bracket SKU and IVA line", () => {
    const raw = `
[EG-120.7.3.LPM] CASCO
EDGE INTEGRAL XPRO
DOT/ECE NEGRO MATE
VISOR PURPURA L
46181705 1.00 PZA 1,050.00 18.00 H87 IVA(16%) $ 861.00

[CH-CC1.103.XL] CASCO
EDGE ABATIBLE ROCKET
DOT CHAPULIN COLORADO
XL
46181705 1.00 PZA 1,200.00 18.00 H87 IVA(16%) $ 984.00
    `;

    const lines = parseEdgeInvoiceText(raw);
    expect(lines).toHaveLength(2);
    expect(lines[0].supplierSku).toBe("EG-120.7.3.LPM");
    expect(lines[0].qty).toBe(1);
    expect(lines[0].unit).toBe("PZA");
    expect(lines[0].unitPriceNet).toBe(1050);
    expect(lines[0].lineTotalNet).toBe(861);
    expect(lines[0].satProductKey).toBe("46181705");

    expect(lines[1].supplierSku).toBe("CH-CC1.103.XL");
    expect(lines[1].lineTotalNet).toBe(984);
  });
});
