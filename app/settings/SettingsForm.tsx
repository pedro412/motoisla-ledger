"use client";

import { useState } from "react";

export function SettingsForm({
  currentRate,
  updatedAt,
}: {
  currentRate: number;
  updatedAt: string | null;
}) {
  const [rate, setRate] = useState(currentRate.toString());
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "opex_rate", value: rate }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Error desconocido");
      }
      setStatus("ok");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="opex-rate">
            Tasa operativa (%)
          </label>
          <div className="flex items-center gap-1">
            <input
              id="opex-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={rate}
              onChange={(e) => {
                setRate(e.target.value);
                setStatus("idle");
              }}
              className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {status === "saving" ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {status === "ok" && (
        <p className="text-sm text-emerald-600">Configuración guardada correctamente.</p>
      )}
      {status === "error" && (
        <p className="text-sm text-rose-600">{errorMsg}</p>
      )}
      {updatedAt && (
        <p className="text-xs text-muted-foreground">
          Última actualización:{" "}
          {new Intl.DateTimeFormat("es-MX", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(updatedAt))}
        </p>
      )}
    </form>
  );
}
