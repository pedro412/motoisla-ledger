"use client";

import { FormEvent, useEffect, useState } from "react";

type Investor = {
  id: string;
  nombre: string;
  tipo: "INVESTOR" | "MOTOISLA";
  capitalInicial: number;
  creadoEn: string;
};

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [capitalDrafts, setCapitalDrafts] = useState<Record<string, string>>({});

  async function loadInvestors() {
    setLoading(true);
    try {
      const res = await fetch("/api/investors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron cargar inversionistas");
      const list = (json.investors as Investor[]) ?? [];
      setInvestors(list);
      setCapitalDrafts(
        Object.fromEntries(
          list.map((i) => [i.id, String(i.capitalInicial)]),
        ),
      );
    } catch (error) {
      setResult(
        JSON.stringify(
          { ok: false, error: error instanceof Error ? error.message : "Error al cargar inversionistas" },
          null,
          2,
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvestors();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult("");
    const form = new FormData(event.currentTarget);

    const payload = {
      nombre: String(form.get("nombre") || "").trim(),
      tipo: String(form.get("tipo") || "INVESTOR"),
      capitalInicial: Number(form.get("capitalInicial") || 0),
    };

    const res = await fetch("/api/investors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
    if (res.ok && json.ok) {
      (event.currentTarget as HTMLFormElement).reset();
      await loadInvestors();
    }
  }

  async function updateCapital(ownerId: string) {
    setResult("");
    const nuevoCapitalInicial = Number(capitalDrafts[ownerId] || 0);
    const res = await fetch(`/api/investors/${encodeURIComponent(ownerId)}/capital`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevoCapitalInicial, motivo: "Ajuste manual desde UI" }),
    });
    const json = await res.json();
    setResult(JSON.stringify(json, null, 2));
    if (res.ok && json.ok) {
      await loadInvestors();
    }
  }

  return (
    <section>
      <div className="card">
        <h1>Inversionistas</h1>
        <form onSubmit={onCreate}>
          <div className="grid">
            <label>Nombre<input name="nombre" required placeholder="Lic" /></label>
            <label>
              Tipo
              <select name="tipo" defaultValue="INVESTOR">
                <option value="INVESTOR">INVESTOR</option>
                <option value="MOTOISLA">MOTOISLA</option>
              </select>
            </label>
            <label>Capital inicial<input name="capitalInicial" type="number" step="0.01" defaultValue="0" required /></label>
          </div>
          <button type="submit">Crear inversionista</button>
        </form>
      </div>

      <div className="card">
        <h2>Lista actual</h2>
        {loading && <p>Cargando...</p>}
        {!loading && (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Capital inicial</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.nombre}</td>
                  <td>{inv.tipo}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={capitalDrafts[inv.id] ?? String(inv.capitalInicial)}
                      onChange={(e) =>
                        setCapitalDrafts((prev) => ({
                          ...prev,
                          [inv.id]: e.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => updateCapital(inv.id)}>
                      Guardar capital
                    </button>
                  </td>
                </tr>
              ))}
              {!investors.length && (
                <tr>
                  <td colSpan={5}>Sin inversionistas.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {result && (
        <div className="card">
          <pre>{result}</pre>
        </div>
      )}
    </section>
  );
}
