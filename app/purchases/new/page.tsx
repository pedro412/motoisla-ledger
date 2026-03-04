"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseInvoiceByFormat, type InvoiceFormat } from "@/lib/parse/invoiceParser";
import type { ParsedLine } from "@/lib/parse/ls2Invoice";
import { MoneyInput } from "@/components/ui/money-input";
import { LoadingButton } from "@/components/ui/loading-button";

type Investor = {
  id: string;
  nombre: string;
};

export default function NewPurchasePage() {
  const router = useRouter();
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [invoiceFormat, setInvoiceFormat] = useState<InvoiceFormat>("LS2");
  const [rawText, setRawText] = useState("");
  const [subtotalNet, setSubtotalNet] = useState("");
  const [taxRate, setTaxRate] = useState("0.16");
  const [taxTotal, setTaxTotal] = useState("");
  const [totalGross, setTotalGross] = useState("");
  const [taxTouched, setTaxTouched] = useState(false);
  const [totalTouched, setTotalTouched] = useState(false);
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [loading, setLoading] = useState(false);
  const [navigatingDashboard, setNavigatingDashboard] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [linePreviewError, setLinePreviewError] = useState("");

  const previewLines = useMemo<ParsedLine[]>(() => {
    const raw = rawText.trim();
    if (!raw) {
      setLinePreviewError("");
      return [];
    }
    try {
      const lines = parseInvoiceByFormat(raw, invoiceFormat);
      setLinePreviewError("");
      return lines;
    } catch (error) {
      setLinePreviewError(error instanceof Error ? error.message : "No se pudo parsear el texto");
      return [];
    }
  }, [rawText, invoiceFormat]);

  const previewSubtotal = useMemo(
    () => round2(previewLines.reduce((acc, line) => acc + Number(line.lineTotalNet || 0), 0)),
    [previewLines],
  );
  const previewItems = useMemo(
    () => round2(previewLines.reduce((acc, line) => acc + Number(line.qty || 0), 0)),
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
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Error cargando inversionistas",
          });
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
    const formEl = event.currentTarget;
    setNotice(null);
    setLoading(true);

    const form = new FormData(formEl);
    const payload = {
      supplier: String(form.get("supplier") || ""),
      invoiceFormat,
      date: String(form.get("date") || ""),
      invoiceRef: String(form.get("invoiceRef") || ""),
      subtotalNet: toNumber(subtotalNet),
      taxTotal: toNumber(taxTotal),
      totalGross: toNumber(totalGross),
      taxRate: toNumber(taxRate, 0.16),
      rawText,
      defaultOwnerId: selectedOwnerId,
    };

    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo guardar la compra");
      }

      setNotice({
        type: "success",
        message: `Compra importada correctamente (ID: ${json.purchaseId}).`,
      });

      formEl.reset();
      setRawText("");
      setSubtotalNet("");
      setTaxRate("0.16");
      setTaxTotal("");
      setTotalGross("");
      setTaxTouched(false);
      setTotalTouched(false);
      setLinePreviewError("");
      setInvoiceFormat("LS2");
      if (investors.length > 0) {
        setSelectedOwnerId(investors[0].id);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Error al guardar la compra",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h1>Nueva compra</h1>
      {notice && (
        <p
          className="mb-3 rounded-md border px-3 py-2 text-sm"
          style={{
            background: notice.type === "success" ? "#ecfdf5" : "#fef2f2",
            borderColor: notice.type === "success" ? "#86efac" : "#fecaca",
            color: notice.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {notice.message}
        </p>
      )}
      <form onSubmit={onSubmit}>
        <div className="grid">
          <label>Proveedor<input name="supplier" required /></label>
          <label>
            Formato factura
            <select value={invoiceFormat} onChange={(e) => setInvoiceFormat(e.target.value as InvoiceFormat)}>
              <option value="LS2">LS2</option>
              <option value="EDGE">EDGE</option>
              <option value="JOE_ROCKET">JOE ROCKET</option>
            </select>
          </label>
          <label>Fecha<input name="date" type="date" required /></label>
          <label>Referencia factura<input name="invoiceRef" /></label>
          <label>
            Subtotal neto
            <MoneyInput
              name="subtotalNet"
              required
              value={subtotalNet}
              onValueChange={setSubtotalNet}
            />
          </label>
          <label>
            IVA total
            <MoneyInput
              name="taxTotal"
              required
              value={taxTotal}
              onValueChange={(next) => {
                setTaxTouched(true);
                setTaxTotal(next);
              }}
            />
          </label>
          <label>
            Total bruto
            <MoneyInput
              name="totalGross"
              required
              value={totalGross}
              onValueChange={(next) => {
                setTotalTouched(true);
                setTotalGross(next);
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
          Texto de factura ({invoiceFormat})
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
            Líneas: <strong>{previewLines.length}</strong> · Artículos: <strong>{previewItems}</strong> · Subtotal detectado:{" "}
            <strong>${formatMoney(previewSubtotal)}</strong>
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
        <LoadingButton
          type="submit"
          loading={loading}
          loadingText="Importando..."
          disabled={previewLines.length === 0 || !!linePreviewError}
        >
          Importar
        </LoadingButton>
        {notice?.type === "success" && (
          <LoadingButton
            type="button"
            variant="secondary"
            loading={navigatingDashboard}
            loadingText="Abriendo dashboard..."
            onClick={async () => {
              if (navigatingDashboard) return;
              setNavigatingDashboard(true);
              router.push("/dashboard");
              router.refresh();
            }}
          >
            Ver dashboard actualizado
          </LoadingButton>
        )}
      </form>
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
