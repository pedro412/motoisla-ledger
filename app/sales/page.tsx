import Link from "next/link";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/authz";
import { DeleteSaleButton } from "@/app/sales/DeleteSaleButton";
import { InfoTooltip } from "@/app/dashboard/InfoTooltip";

export default async function SalesPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section>
        <h1>Ventas</h1>
        <div className="card">No autenticado.</div>
      </section>
    );
  }

  if (!isStaff(user)) {
    return (
      <section>
        <h1>Ventas</h1>
        <div className="card">No autorizado.</div>
      </section>
    );
  }

  const sales = await db.sale.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      date: true,
      channel: true,
      totalGross: true,
      terminalFeeTotal: true,
      totalNetAfterFee: true,
      terminalPayment: true,
      threeMonthsNoInterest: true,
      lines: {
        select: {
          id: true,
          sku: true,
          lot: {
            select: {
              description: true,
              owner: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
      profitSplits: {
        where: { status: "TRANSFERRED" },
        select: { id: true },
      },
    },
  });

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="mb-1 text-white">Ventas</h1>
            <p className="text-sm text-emerald-50">
              Gestión de ventas y borrado con restauración automática de stock, capital y utilidad.
            </p>
          </div>
          <Link href="/sales/new" className="move-badge move-badge-transfer border border-white/35 bg-white/20 text-white">
            Registrar nueva venta
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2">Historial ({sales.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>ID Venta</th>
                <th>Inversionista(s)</th>
                <th>Líneas</th>
                <th>Productos</th>
                <th>Cobro</th>
                <th>Bruto</th>
                <th>Comisión</th>
                <th>Neto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const ownerLabels = Array.from(
                  new Set(
                    sale.lines
                      .map((line) => line.lot.owner)
                      .filter(Boolean)
                      .map((owner) => `${owner.name} (${owner.id})`),
                  ),
                );
                const hasTransferred = sale.profitSplits.length > 0;
                const paymentLabel = paymentLabelFromSale(
                  sale.terminalPayment,
                  sale.threeMonthsNoInterest,
                );
                const products = uniqueProducts(
                  sale.lines.map((line) => ({
                    sku: line.sku,
                    description: line.lot.description,
                  })),
                );
                const productsSummary = summarizeProducts(products);

                return (
                  <tr key={sale.id}>
                    <td>{formatDate(sale.date)}</td>
                    <td className="font-mono text-sm">{sale.id}</td>
                    <td>{ownerLabels.join(", ") || "-"}</td>
                    <td>{sale.lines.length}</td>
                    <td>
                      {products.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span>{productsSummary}</span>
                          <InfoTooltip side="right">
                            <p className="mb-2 font-semibold text-white">Productos vendidos</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {products.map((product) => (
                                <li key={`${product.sku}-${product.description}`}>{product.sku} - {product.description}</li>
                              ))}
                            </ul>
                          </InfoTooltip>
                        </span>
                      ) : "-"}
                    </td>
                    <td>{paymentLabel}</td>
                    <td className="text-right">${formatMoney(toNumber(sale.totalGross))}</td>
                    <td className="text-right">${formatMoney(toNumber(sale.terminalFeeTotal))}</td>
                    <td className="text-right">${formatMoney(toNumber(sale.totalNetAfterFee))}</td>
                    <td>
                      <DeleteSaleButton
                        saleId={sale.id}
                        disabled={hasTransferred}
                        disabledReason={
                          hasTransferred ? "No se puede borrar porque esta venta ya tiene utilidad transferida." : undefined
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={10}>Sin ventas todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function toNumber(value: Prisma.Decimal | number | null | undefined) {
  if (value == null) return 0;
  return Number(value);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function paymentLabelFromSale(terminalPayment: boolean, threeMonthsNoInterest: boolean) {
  if (!terminalPayment) return "Sin terminal";
  if (threeMonthsNoInterest) return "Terminal 3 MSI";
  return "Terminal débito/1 exhibición";
}

function uniqueProducts(products: Array<{ sku: string; description: string }>) {
  const seen = new Set<string>();
  const out: Array<{ sku: string; description: string }> = [];

  for (const product of products) {
    const sku = String(product.sku || "").trim();
    const description = String(product.description || "").replace(/\s+/g, " ").trim();
    if (!sku && !description) continue;
    const key = `${sku}::${description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sku: sku || "-", description: description || "-" });
  }

  return out;
}

function summarizeProducts(products: Array<{ sku: string; description: string }>) {
  if (!products.length) return "-";
  const first = `${products[0].sku} - ${products[0].description}`;
  if (products.length === 1) return first;
  return `${first} +${products.length - 1}`;
}
