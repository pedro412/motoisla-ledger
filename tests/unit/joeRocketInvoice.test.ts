import { parseJoeRocketInvoiceText } from "@/lib/parse/joeRocketInvoice";

describe("joe rocket invoice parser", () => {
  it("parses product blocks and detached price blocks", () => {
    const raw = `
MOTO BOUTIQUE S.A DE C.V
OFERTA DE VENTAS
04/03/2026
Moneda:MXP
CASCO / RKT 240 / REACTOR / AMARILLO/ROJO / 2EG
001 H87
JRM26181-6
CASCO / RKT 210 / SONIC / GRIS BRILLOSO/NEGRO/NEON / 2EG
002 H87
JRM251899-16
PANTALON / ALTER EGO 15.0 (LARGO) / NEGRO / EG
003 H87
JRC23140-10
1 1,640.79 16.000 1,640.79
1 1,464.93 16.000 1,464.93
1 2,637.35 16.000 2,637.35
Subtotal de la oferta:
5,743.07 MXP
    `;

    const lines = parseJoeRocketInvoiceText(raw);
    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatchObject({
      supplierSku: "JRM26181-6",
      qty: 1,
      unit: "H87",
      unitPriceNet: 1640.79,
      lineTotalNet: 1640.79,
    });
    expect(lines[0].description).toContain("CASCO / RKT 240 / REACTOR");

    expect(lines[1]).toMatchObject({
      supplierSku: "JRM251899-16",
      qty: 1,
      unit: "H87",
      unitPriceNet: 1464.93,
      lineTotalNet: 1464.93,
    });

    expect(lines[2]).toMatchObject({
      supplierSku: "JRC23140-10",
      qty: 1,
      unit: "H87",
      unitPriceNet: 2637.35,
      lineTotalNet: 2637.35,
    });
  });

  it("throws when products and prices count differs", () => {
    const raw = `
CASCO / RKT 240 / REACTOR / AMARILLO/ROJO / 2EG
001 H87
JRM26181-6
1 1,640.79 16.000 1,640.79
1 1,464.93 16.000 1,464.93
    `;

    expect(() => parseJoeRocketInvoiceText(raw)).toThrow("Factura Joe Rocket inconsistente");
  });
});
