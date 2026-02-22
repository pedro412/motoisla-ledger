"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { parseLS2InvoiceText, type ParsedLine } from "@/lib/parse/ls2Invoice";

type Investor = {
  id: string;
  nombre: string;
};

export default function NewPurchasePage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [rawText, setRawText] = useState("");
  const [subtotalNet, setSubtotalNet] = useState("");
  const [taxRate, setTaxRate] = useState("0.16");
  const [taxTotal, setTaxTotal] = useState("");
  const [totalGross, setTotalGross] = useState("");
  const [taxTouched, setTaxTouched] = useState(false);
  const [totalTouched, setTotalTouched] = useState(false);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [linePreviewError, setLinePreviewError] = useState("");

  const previewLines = useMemo<ParsedLine[]>(() => {
    const raw = rawText.trim();
    if (!raw) {
      setLinePreviewError("");
      return [];
    }
    try {
      const lines = parseLS2InvoiceText(raw);
      setLinePreviewError("");
      return lines;
    } catch (error) {
      setLinePreviewError(error instanceof Error ? error.message : "No se pudo parsear el texto");
      return [];
    }
  }, [rawText]);

  const previewSubtotal = useMemo(
    () => round2(previewLines.reduce((acc, line) => acc + Number(line.lineTotalNet || 0), 0)),
    [previewLines],
  );
  const subtotalValue = toNumber(subtotalNet);
  const taxRateValue = toNumber(taxRate, 0.16);
  const autoTax = round2(subtotalValue * taxRateValue);
  const autoTotal = round2(subtotalValue + autoTax);
  const taxDiff = round2(Math.abs(toNumber(taxTotal) - autoTax));
  const totalDiff = round2(Math.abs(toNumber(totalGross) - autoTotal));

  useEffect(() => {
    if (!taxTouched) {
      setTaxTotal(subtotalNet ? autoTax.toFixed(2) : "");
    }
    if (!totalTouched) {
      setTotalGross(subtotalNet ? autoTotal.toFixed(2) : "");
    }
  }, [subtotalNet, taxRate, taxTouched, totalTouched, autoTax, autoTotal]);

  useEffect(() => {
    let cancelled = false;
    async function loadInvestors() {
      setLoadingInvestors(true);
      try {
        const res = await fetch("/api/investors", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "No se pudieron cargar inversionistas");
        }
        if (!cancelled) {
          const list = (json.investors as Investor[]) ?? [];
          setInvestors(list);
          setSelectedOwnerId((prev) => prev || list[0]?.id || "");
        }
      } catch (error) {
        if (!cancelled) {
          setResult(
            JSON.stringify(
              { ok: false, error: error instanceof Error ? error.message : "Error cargando inversionistas" },
              null,
              2,
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingInvestors(false);
        }
      }
    }
    loadInvestors();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult("");

    const form = new FormData(event.currentTarget);
    const payload = {
      supplier: String(form.get("supplier") || ""),
      date: String(form.get("date") || ""),
      invoiceRef: String(form.get("invoiceRef") || ""),
      subtotalNet: toNumber(subtotalNet),
      taxTotal: toNumber(taxTotal),
      totalGross: toNumber(totalGross),
      taxRate: toNumber(taxRate, 0.16),
      rawText,
      defaultOwnerId: selectedOwnerId,
    };

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
    setLoading(false);
  }

  return (
    <section className="card">
      <h1>Nueva compra</h1>
      <form onSubmit={onSubmit}>
        <div className="grid">
          <label>Proveedor<input name="supplier" required /></label>
          <label>Fecha<input name="date" type="date" required /></label>
          <label>Referencia factura<input name="invoiceRef" /></label>
          <label>
            Subtotal neto
            <input
              name="subtotalNet"
              type="number"
              step="0.01"
              required
              value={subtotalNet}
              onChange={(e) => setSubtotalNet(e.target.value)}
            />
          </label>
          <label>
            IVA total
            <input
              name="taxTotal"
              type="number"
              step="0.01"
              required
              value={taxTotal}
              onChange={(e) => {
                setTaxTouched(true);
                setTaxTotal(e.target.value);
              }}
            />
          </label>
          <label>
            Total bruto
            <input
              name="totalGross"
              type="number"
              step="0.01"
              required
              value={totalGross}
              onChange={(e) => {
                setTotalTouched(true);
                setTotalGross(e.target.value);
              }}
            />
          </label>
          <label>
            Tasa IVA
            <input name="taxRate" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </label>
          <label>
            Inversionista
            <select
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              disabled={loadingInvestors || investors.length === 0}
              required
            >
              {investors.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.nombre} ({inv.id})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="card" style={{ marginTop: 8, marginBottom: 8 }}>
          <p style={{ marginTop: 0, marginBottom: 6, fontSize: 13 }}>
            Cálculo automático: IVA esperado <strong>${formatMoney(autoTax)}</strong> · Total esperado{" "}
            <strong>${formatMoney(autoTotal)}</strong>
          </p>
          {(taxDiff > 0.01 || totalDiff > 0.01) && (
            <p style={{ margin: 0, fontSize: 13, color: "#b45309" }}>
              Aviso: los montos capturados difieren del cálculo automático (IVA dif: ${formatMoney(taxDiff)} · Total dif: $
              {formatMoney(totalDiff)}).
            </p>
          )}
        </div>
        <label>
          Texto de factura LS2
          <textarea
            name="rawText"
            rows={12}
            required
            placeholder="Pega el texto de factura aquí"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />
        </label>
        <div className="card" style={{ marginTop: 8 }}>
          <h3 style={{ marginTop: 0 }}>Vista previa de líneas detectadas</h3>
          <p style={{ marginTop: 0, fontSize: 13 }}>
            Líneas: <strong>{previewLines.length}</strong> · Subtotal detectado: <strong>${formatMoney(previewSubtotal)}</strong>
          </p>
          {linePreviewError && <p style={{ color: "crimson", marginTop: 0 }}>{linePreviewError}</p>}
          {!linePreviewError && previewLines.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Cant.</th>
                    <th>Unidad</th>
                    <th>Descripción</th>
                    <th>P. unit neto</th>
                    <th>Total neto</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((line, idx) => (
                    <tr key={`${line.supplierSku}-${idx}`}>
                      <td>{line.supplierSku}</td>
                      <td>{line.qty}</td>
                      <td>{line.unit}</td>
                      <td>{line.description}</td>
                      <td>{line.unitPriceNet != null ? `$${formatMoney(line.unitPriceNet)}` : "-"}</td>
                      <td>${formatMoney(line.lineTotalNet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!linePreviewError && rawText.trim().length > 0 && previewLines.length === 0 && (
            <p style={{ marginBottom: 0 }}>No se detectaron líneas válidas aún.</p>
          )}
        </div>
        <button type="submit" disabled={loading || previewLines.length === 0 || !!linePreviewError}>
          {loading ? "Importando..." : "Importar"}
        </button>
      </form>
      {result && <pre>{result}</pre>}
    </section>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function toNumber(value: string, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}
