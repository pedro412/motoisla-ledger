"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { useRouter } from "next/navigation";

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
type Investor = { id: string; nombre: string };

const emptyLine: SaleLine = { lotId: "", sku: "", qty: 1, unitPriceGross: 0, discountGross: 0 };

export default function NewSalePage() {
  const router = useRouter();
  const [lines, setLines] = useState<SaleLine[]>([{ ...emptyLine }]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [terminalPayment, setTerminalPayment] = useState(false);
  const [threeMonthsNoInterest, setThreeMonthsNoInterest] = useState(false);
  const [lots, setLots] = useState<LotOption[]>([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [lotsError, setLotsError] = useState("");
  const [loading, setLoading] = useState(false);
  const [navigatingDashboard, setNavigatingDashboard] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const lotsById = useMemo(() => new Map(lots.map((lot) => [lot.lotId, lot])), [lots]);

  useEffect(() => {
    setLines((prev) =>
      prev.map((line) => {
        if (!line.lotId) return line;
        const lot = lotsById.get(line.lotId);
        if (lot) return line;
        return { ...line, lotId: "", sku: "" };
      }),
    );
  }, [lotsById]);

  useEffect(() => {
    let cancelled = false;

    async function loadInvestorsAndLots() {
      setLoadingLots(true);
      setLotsError("");
      try {
        const [invRes, lotRes] = await Promise.all([
          fetch("/api/investors", { cache: "no-store" }),
          fetch("/api/lots", { cache: "no-store" }),
        ]);
        const invJson = await invRes.json();
        const lotJson = await lotRes.json();
        if (!invRes.ok || !invJson.ok) throw new Error(invJson.error || "No se pudieron cargar inversionistas");
        if (!lotRes.ok || !lotJson.ok) throw new Error(lotJson.error || "No se pudieron cargar los lotes");
        if (!cancelled) {
          setInvestors(invJson.investors ?? []);
          setLots(lotJson.lots);
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

    loadInvestorsAndLots();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function reloadLotsByOwner() {
      try {
        const query = ownerFilter ? `?ownerId=${encodeURIComponent(ownerFilter)}` : "";
        const res = await fetch(`/api/lots${query}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron cargar los lotes");
        if (!cancelled) setLots(json.lots);
      } catch (error) {
        if (!cancelled) {
          setLotsError(error instanceof Error ? error.message : "Error cargando lotes");
        }
      }
    }
    reloadLotsByOwner();
    return () => {
      cancelled = true;
    };
  }, [ownerFilter]);

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

  function computeLineMetrics(line: SaleLine) {
    const lot = lotsById.get(line.lotId);
    if (!lot) return null;

    const qty = Number(line.qty || 0);
    const gross = qty * Number(line.unitPriceGross || 0) - Number(line.discountGross || 0);
    const fee = gross * commissionRate;
    const net = gross - fee;
    const cogs = qty * Number(lot.unitCostGross || 0);
    const profit = net - cogs;
    const marginPct = net > 0 ? (profit / net) * 100 : 0;

    return { gross, fee, net, cogs, profit, marginPct };
  }

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
    const formEl = event.currentTarget;
    setNotice(null);
    setLoading(true);

    for (let i = 0; i < lines.length; i += 1) {
      const remaining = getRemainingQtyForLine(i);
      if (remaining == null) continue;
      if (lines[i].qty > remaining) {
        setNotice({
          type: "error",
          message: `La cantidad en la línea ${i + 1} excede el disponible del lote (${remaining}).`,
        });
        setLoading(false);
        return;
      }
    }

    const form = new FormData(formEl);
    const payload = {
      date: String(form.get("date") || ""),
      channel: String(form.get("channel") || "STORE"),
      notes: String(form.get("notes") || ""),
      terminalPayment,
      threeMonthsNoInterest: terminalPayment ? threeMonthsNoInterest : false,
      lines,
    };

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo guardar la venta");
      }

      setNotice({
        type: "success",
        message: `Venta guardada correctamente (ID: ${json.saleId}).`,
      });

      formEl.reset();
      setLines([{ ...emptyLine }]);
      setTerminalPayment(false);
      setThreeMonthsNoInterest(false);
      setOwnerFilter("");
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Error al guardar la venta",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h1>Nueva venta</h1>
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
      {loadingLots && <p>Cargando lotes disponibles...</p>}
      {lotsError && <p style={{ color: "crimson" }}>Error cargando lotes: {lotsError}</p>}
      <form onSubmit={onSubmit}>
        <div className="grid">
          <label>Fecha<input name="date" type="date" required /></label>
          <label>
            Inversionista (filtro lotes)
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="">Todos</option>
              {investors.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.nombre} ({inv.id})
                </option>
              ))}
            </select>
          </label>
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
            Tasa comisión aplicada: {(commissionRate * 100).toFixed(2)}% | Comisión estimada: ${formatMoney(commissionPreview)} | Ingreso neto estimado: ${formatMoney(netPreview)}
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
            {(() => {
              const metrics = computeLineMetrics(line);
              if (!metrics) return null;
              return (
                <p style={{ marginTop: 0, marginBottom: 10, fontSize: 13, fontWeight: 600, color: metrics.profit >= 0 ? "#047857" : "#be123c" }}>
                  Utilidad estimada: ${formatMoney(metrics.profit)} ({metrics.marginPct.toFixed(2)}%)
                </p>
              );
            })()}
            <div className="grid">
              <label>
                Lot ID
                <select
                  value={line.lotId}
                  onChange={(e) => updateLotId(i, e.target.value)}
                  required
                >
                  <option value="">Selecciona lote</option>
                  {lots.map((lot) => (
                    <option key={lot.lotId} value={lot.lotId}>
                      {buildLotOptionLabel(lot)}
                    </option>
                  ))}
                </select>
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
                {lotsById.get(line.lotId)?.sku} | Producto: {lotsById.get(line.lotId)?.description}
              </p>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={addLine}>Agregar línea</button>
          <LoadingButton type="submit" loading={loading} loadingText="Guardando...">
            Guardar venta
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
        </div>
      </form>
    </section>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function buildLotOptionLabel(lot: LotOption) {
  const shortDescription = truncate(lot.description, 52);
  return `${lot.lotId} | ${lot.sku || "-"} | ${shortDescription} | Disp: ${lot.qtyAvailable} | Owner: ${lot.ownerId}`;
}

function truncate(text: string, max: number) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 3))}...`;
}
