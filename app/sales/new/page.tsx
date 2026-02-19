"use client";

import { FormEvent, useState } from "react";

type SaleLine = {
  lotId: string;
  sku: string;
  qty: number;
  unitPriceGross: number;
  discountGross: number;
};

const emptyLine: SaleLine = { lotId: "", sku: "", qty: 1, unitPriceGross: 0, discountGross: 0 };

export default function NewSalePage() {
  const [lines, setLines] = useState<SaleLine[]>([{ ...emptyLine }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

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

  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult("");

    const form = new FormData(event.currentTarget);
    const payload = {
      date: String(form.get("date") || ""),
      channel: String(form.get("channel") || "STORE"),
      notes: String(form.get("notes") || ""),
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

        {lines.map((line, i) => (
          <div className="card" key={`line-${i}`}>
            <h3>Línea {i + 1}</h3>
            <div className="grid">
              <label>Lot ID<input value={line.lotId} onChange={(e) => updateLine(i, "lotId", e.target.value)} required /></label>
              <label>SKU<input value={line.sku} onChange={(e) => updateLine(i, "sku", e.target.value)} required /></label>
              <label>Cantidad<input type="number" step="0.01" value={line.qty} onChange={(e) => updateLine(i, "qty", e.target.value)} required /></label>
              <label>Precio unitario bruto<input type="number" step="0.01" value={line.unitPriceGross} onChange={(e) => updateLine(i, "unitPriceGross", e.target.value)} required /></label>
              <label>Descuento bruto<input type="number" step="0.01" value={line.discountGross} onChange={(e) => updateLine(i, "discountGross", e.target.value)} /></label>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={addLine}>Agregar línea</button>
          <button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar venta"}</button>
        </div>
      </form>
      {result && <pre>{result}</pre>}
    </section>
  );
}
