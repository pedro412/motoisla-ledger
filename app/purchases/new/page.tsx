"use client";

import { FormEvent, useEffect, useState } from "react";

type Investor = {
  id: string;
  nombre: string;
};

export default function NewPurchasePage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [loadingInvestors, setLoadingInvestors] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");

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
      subtotalNet: Number(form.get("subtotalNet") || 0),
      taxTotal: Number(form.get("taxTotal") || 0),
      totalGross: Number(form.get("totalGross") || 0),
      taxRate: Number(form.get("taxRate") || 0.16),
      rawText: String(form.get("rawText") || ""),
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
          <label>Subtotal neto<input name="subtotalNet" type="number" step="0.01" required /></label>
          <label>IVA total<input name="taxTotal" type="number" step="0.01" required /></label>
          <label>Total bruto<input name="totalGross" type="number" step="0.01" required /></label>
          <label>Tasa IVA<input name="taxRate" type="number" step="0.01" defaultValue="0.16" /></label>
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
        <label>
          Texto de factura LS2
          <textarea name="rawText" rows={12} required placeholder="Pega el texto de factura aquí" />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Importando..." : "Importar"}</button>
      </form>
      {result && <pre>{result}</pre>}
    </section>
  );
}
