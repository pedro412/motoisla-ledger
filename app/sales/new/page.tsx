"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SaleLine = {
  lotId: string;
  sku: string;
  qty: number;
  unitPriceGross: number;
  discountGross: number;
};

type LotOption = {
  lotId: string;
  sku: string;
  ownerId: string;
  qtyAvailable: number;
  unitCostGross: number;
  description: string;
};

const emptyLine: SaleLine = { lotId: "", sku: "", qty: 1, unitPriceGross: 0, discountGross: 0 };

export default function NewSalePage() {
  const [lines, setLines] = useState<SaleLine[]>([{ ...emptyLine }]);
  const [terminalPayment, setTerminalPayment] = useState(false);
  const [threeMonthsNoInterest, setThreeMonthsNoInterest] = useState(false);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [lotsError, setLotsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  const lotsById = useMemo(() => new Map(lots.map((lot) => [lot.lotId, lot])), [lots]);

  useEffect(() => {
    let cancelled = false;

    async function loadLots() {
      setLoadingLots(true);
      setLotsError("");
      try {
        const res = await fetch("/api/lots", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || "No se pudieron cargar los lotes");
        }
        if (!cancelled) {
          setLots(json.lots);
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Error cargando lotes";
          setLotsError(message);
        }
      } finally {
        if (!cancelled) {
          setLoadingLots(false);
        }
      }
    }

    loadLots();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateLine(index: number, key: keyof SaleLine, value: string) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              [key]: key === "lotId" || key === "sku" ? value : Number(value),
            }
          : line,
      ),
    );
  }

  function updateLotId(index: number, lotId: string) {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const lot = lotsById.get(lotId);
        return {
          ...line,
          lotId,
          sku: lot?.sku || line.sku,
        };
      }),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  const grossPreview = lines.reduce(
    (acc, line) => acc + Number(line.qty || 0) * Number(line.unitPriceGross || 0) - Number(line.discountGross || 0),
    0,
  );
  const commissionRate = terminalPayment ? (threeMonthsNoInterest ? 0.0558 : 0.02) : 0;
  const commissionPreview = grossPreview * commissionRate;
  const netPreview = grossPreview - commissionPreview;

  function getRemainingQtyForLine(index: number) {
    const line = lines[index];
    if (!line?.lotId) return undefined;
    const selected = lotsById.get(line.lotId);
    if (!selected) return undefined;

    const requestedInOtherLines = lines.reduce((acc, current, currentIndex) => {
      if (currentIndex === index) return acc;
      if (current.lotId !== line.lotId) return acc;
      return acc + Number(current.qty || 0);
    }, 0);

    return Math.max(0, selected.qtyAvailable - requestedInOtherLines);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult("");

    for (let i = 0; i < lines.length; i += 1) {
      const remaining = getRemainingQtyForLine(i);
      if (remaining == null) continue;
      if (lines[i].qty > remaining) {
        setResult(
          JSON.stringify(
            {
              ok: false,
              error: `La cantidad en la línea ${i + 1} excede el disponible del lote (${remaining}).`,
            },
            null,
            2,
          ),
        );
        setLoading(false);
        return;
      }
    }

    const form = new FormData(event.currentTarget);
    const payload = {
      date: String(form.get("date") || ""),
      channel: String(form.get("channel") || "STORE"),
      notes: String(form.get("notes") || ""),
      terminalPayment,
      threeMonthsNoInterest: terminalPayment ? threeMonthsNoInterest : false,
      lines,
    };

    const res = await fetch("/api/sales", {
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
      <h1>Nueva venta</h1>
      {loadingLots && <p>Cargando lotes disponibles...</p>}
      {lotsError && <p style={{ color: "crimson" }}>Error cargando lotes: {lotsError}</p>}
      <form onSubmit={onSubmit}>
        <div className="grid">
          <label>Fecha<input name="date" type="date" required /></label>
          <label>
            Canal
            <select name="channel" defaultValue="STORE">
              <option value="STORE">STORE</option>
              <option value="ONLINE">ONLINE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
          <label>Notas<input name="notes" /></label>
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Método de cobro</h3>
          <div className="grid">
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={terminalPayment}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTerminalPayment(checked);
                  if (!checked) setThreeMonthsNoInterest(false);
                }}
              />
              Pago con terminal bancaria
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={threeMonthsNoInterest}
                disabled={!terminalPayment}
                onChange={(e) => setThreeMonthsNoInterest(e.target.checked)}
              />
              Tarjeta de crédito a 3 MSI (5.58%)
            </label>
          </div>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            Tasa comisión aplicada: {(commissionRate * 100).toFixed(2)}% | Comisión estimada: ${commissionPreview.toFixed(2)} | Ingreso neto estimado: ${netPreview.toFixed(2)}
          </p>
          {terminalPayment && !threeMonthsNoInterest && (
            <p style={{ marginTop: 6, fontSize: 12, color: "#4b5563" }}>
              Se aplicará comisión del 2.00% (débito / una sola exhibición).
            </p>
          )}
        </div>

        {lines.map((line, i) => (
          <div className="card" key={`line-${i}`}>
            <h3>Línea {i + 1}</h3>
            <div className="grid">
              <label>
                Lot ID
                <input
                  value={line.lotId}
                  onChange={(e) => updateLotId(i, e.target.value)}
                  list="lots-options"
                  required
                />
              </label>
              <label>SKU<input value={line.sku} onChange={(e) => updateLine(i, "sku", e.target.value)} required /></label>
              <label>
                Cantidad
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={getRemainingQtyForLine(i)}
                  value={line.qty}
                  onChange={(e) => updateLine(i, "qty", e.target.value)}
                  required
                />
              </label>
              <label>Precio unitario bruto<input type="number" step="0.01" value={line.unitPriceGross} onChange={(e) => updateLine(i, "unitPriceGross", e.target.value)} required /></label>
              <label>Descuento bruto<input type="number" step="0.01" value={line.discountGross} onChange={(e) => updateLine(i, "discountGross", e.target.value)} /></label>
            </div>
            {line.lotId && lotsById.get(line.lotId) && (
              <p style={{ marginTop: 8, fontSize: 13 }}>
                Disponible total: {lotsById.get(line.lotId)?.qtyAvailable} | Disponible para esta línea: {getRemainingQtyForLine(i)} | Owner: {lotsById.get(line.lotId)?.ownerId} | SKU:{" "}
                {lotsById.get(line.lotId)?.sku}
              </p>
            )}
          </div>
        ))}
        <datalist id="lots-options">
          {lots.map((lot) => (
            <option key={lot.lotId} value={lot.lotId}>
              {`${lot.sku} | Disp: ${lot.qtyAvailable} | Owner: ${lot.ownerId}`}
            </option>
          ))}
        </datalist>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={addLine}>Agregar línea</button>
          <button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar venta"}</button>
        </div>
      </form>
      {result && <pre>{result}</pre>}
    </section>
  );
}
