"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TransferProfitButton({ ownerId, available }: { ownerId: string; available: number }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"all" | "partial">("all");
  const [amount, setAmount] = useState("");
  const router = useRouter();

  async function transfer() {
    if (available <= 0) return;
    const parsedAmount = Number(amount || 0);
    const selectedAmount = mode === "all" ? undefined : parsedAmount;
    if (mode === "partial" && (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > available)) {
      setMsg(`Monto inválido. Debe ser mayor a 0 y menor o igual a ${available.toFixed(2)}.`);
      return;
    }

    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/capital/transfer-profit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId, amount: selectedAmount }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo transferir utilidad");
      }
      setMsg(`Transferido: $${Number(json.transferredAmount ?? 0).toFixed(2)}`);
      setOpen(false);
      setAmount("");
      router.refresh();
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error de transferencia");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={() => setOpen(true)} disabled={loading || available <= 0}>
        {loading ? "Transfiriendo..." : "Pasar utilidad a capital"}
      </button>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 10, width: "min(460px, 92vw)", padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Transferir utilidad a capital</h3>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Utilidad disponible: <strong>${available.toFixed(2)}</strong>
            </p>
            <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="transfer-mode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                />
                Transferir todo
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="transfer-mode"
                  checked={mode === "partial"}
                  onChange={() => setMode("partial")}
                />
                Transferir monto parcial
              </label>
              <label>
                Monto a transferir
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={available}
                  disabled={mode !== "partial"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  if (loading) return;
                  setOpen(false);
                }}
                style={{ background: "#6b7280" }}
              >
                Cancelar
              </button>
              <button type="button" onClick={transfer} disabled={loading}>
                {loading ? "Transfiriendo..." : "Aceptar y transferir"}
              </button>
            </div>
          </div>
        </div>
      )}
      {msg && <p style={{ marginTop: 8, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}
