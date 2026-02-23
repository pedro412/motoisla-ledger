"use client";

import { FormEvent, useEffect, useState } from "react";
import { MoneyInput } from "@/components/ui/money-input";
import { LoadingButton } from "@/components/ui/loading-button";

type Investor = {
  id: string;
  nombre: string;
  tipo: "INVESTOR" | "MOTOISLA";
  capitalInicial: number;
  creadoEn: string;
  usuarioInversionista?: string | null;
};

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [capitalDrafts, setCapitalDrafts] = useState<Record<string, string>>({});
  const [newCapitalInicial, setNewCapitalInicial] = useState("0.00");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newInvestorUserOwnerId, setNewInvestorUserOwnerId] = useState("");
  const [newInvestorUsername, setNewInvestorUsername] = useState("");
  const [newInvestorPassword, setNewInvestorPassword] = useState("");
  const [newInvestorUserName, setNewInvestorUserName] = useState("");

  async function loadInvestors() {
    setLoading(true);
    try {
      const res = await fetch("/api/investors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron cargar inversionistas");
      const list = (json.investors as Investor[]) ?? [];
      setInvestors(list);
      setNewInvestorUserOwnerId((prev) => prev || list[0]?.id || "");
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
    if (pendingAction) return;
    setPendingAction("create");
    setResult("");
    const form = new FormData(event.currentTarget);

    const payload = {
      nombre: String(form.get("nombre") || "").trim(),
      tipo: String(form.get("tipo") || "INVESTOR"),
      capitalInicial: Number(newCapitalInicial || 0),
    };

    try {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
      if (res.ok && json.ok) {
        (event.currentTarget as HTMLFormElement).reset();
        setNewCapitalInicial("0.00");
        await loadInvestors();
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function updateCapital(ownerId: string) {
    if (pendingAction) return;
    setPendingAction(`update:${ownerId}`);
    setResult("");
    const nuevoCapitalInicial = Number(capitalDrafts[ownerId] || 0);
    try {
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
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteInvestor(ownerId: string, nombre: string) {
    if (pendingAction) return;
    setResult("");
    const typed = window.prompt(
      `Vas a borrar completamente a ${nombre} (${ownerId}).\n` +
        "Esto elimina compras, lotes, ventas relacionadas, movimientos y utilidades.\n" +
        "Escribe BORRAR para confirmar:",
    );
    if (!typed) return;
    if (typed.trim().toUpperCase() !== "BORRAR") {
      setResult(JSON.stringify({ ok: false, error: "Confirmación inválida. Debes escribir BORRAR." }, null, 2));
      return;
    }
    setPendingAction(`delete:${ownerId}`);

    try {
      const res = await fetch(`/api/investors/${encodeURIComponent(ownerId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: typed.trim() }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
      if (res.ok && json.ok) {
        await loadInvestors();
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function createInvestorUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setPendingAction("create-user");
    setResult("");
    try {
      const res = await fetch("/api/users/investor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: newInvestorUserOwnerId,
          username: newInvestorUsername.trim(),
          password: newInvestorPassword,
          name: newInvestorUserName.trim() || undefined,
        }),
      });
      const json = await res.json();
      setResult(JSON.stringify(json, null, 2));
      if (res.ok && json.ok) {
        setNewInvestorUsername("");
        setNewInvestorPassword("");
        setNewInvestorUserName("");
        await loadInvestors();
      }
    } finally {
      setPendingAction(null);
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
            <label>
              Capital inicial
              <MoneyInput name="capitalInicial" value={newCapitalInicial} onValueChange={setNewCapitalInicial} required />
            </label>
          </div>
          <LoadingButton type="submit" disabled={!!pendingAction} loading={pendingAction === "create"} loadingText="Creando...">
            Crear inversionista
          </LoadingButton>
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
                <th>Usuario inversionista</th>
                <th>Capital inicial</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.nombre}</td>
                  <td>{inv.tipo}</td>
                  <td>{inv.usuarioInversionista || <span style={{ color: "#64748b" }}>Sin usuario</span>}</td>
                  <td>
                    <MoneyInput
                      value={capitalDrafts[inv.id] ?? String(inv.capitalInicial)}
                      onValueChange={(next) =>
                        setCapitalDrafts((prev) => ({
                          ...prev,
                          [inv.id]: next,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <LoadingButton
                        type="button"
                        disabled={!!pendingAction}
                        onClick={() => updateCapital(inv.id)}
                        loading={pendingAction === `update:${inv.id}`}
                        loadingText="Guardando..."
                      >
                        Guardar capital
                      </LoadingButton>
                      <LoadingButton
                        type="button"
                        variant="danger"
                        style={{ background: "#dc2626" }}
                        disabled={!!pendingAction}
                        onClick={() => deleteInvestor(inv.id, inv.nombre)}
                        loading={pendingAction === `delete:${inv.id}`}
                        loadingText="Borrando..."
                      >
                        Borrar
                      </LoadingButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!investors.length && (
                <tr>
                  <td colSpan={6}>Sin inversionistas.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Crear usuario para inversionista</h2>
        <form onSubmit={createInvestorUser}>
          <div className="grid">
            <label>
              Inversionista
              <select
                value={newInvestorUserOwnerId}
                onChange={(e) => setNewInvestorUserOwnerId(e.target.value)}
                required
              >
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nombre} ({inv.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Username
              <input
                value={newInvestorUsername}
                onChange={(e) => setNewInvestorUsername(e.target.value)}
                placeholder="inversionista.lic"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={newInvestorPassword}
                onChange={(e) => setNewInvestorPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Nombre (opcional)
              <input
                value={newInvestorUserName}
                onChange={(e) => setNewInvestorUserName(e.target.value)}
                placeholder="Nombre visible"
              />
            </label>
          </div>
          <LoadingButton
            type="submit"
            disabled={!!pendingAction || investors.length === 0}
            loading={pendingAction === "create-user"}
            loadingText="Creando usuario..."
          >
            Crear usuario inversionista
          </LoadingButton>
        </form>
      </div>

      {result && (
        <div className="card">
          <pre>{result}</pre>
        </div>
      )}
    </section>
  );
}
