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
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [newCapitalInicial, setNewCapitalInicial] = useState("0.00");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [newInvestorUserOwnerId, setNewInvestorUserOwnerId] = useState("");
  const [newInvestorUsername, setNewInvestorUsername] = useState("");
  const [newInvestorPassword, setNewInvestorPassword] = useState("");
  const [newInvestorUserName, setNewInvestorUserName] = useState("");
  const [movementOwnerId, setMovementOwnerId] = useState("");
  const [movementType, setMovementType] = useState<"APORTE_CAPITAL" | "RETIRO_CAPITAL">("APORTE_CAPITAL");
  const [movementAmount, setMovementAmount] = useState("0.00");
  const [movementMotivo, setMovementMotivo] = useState("");

  async function loadInvestors() {
    setLoading(true);
    try {
      const res = await fetch("/api/investors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudieron cargar inversionistas");
      const list = (json.investors as Investor[]) ?? [];
      setInvestors(list);
      setNewInvestorUserOwnerId((prev) => prev || list[0]?.id || "");
      setMovementOwnerId((prev) => prev || list[0]?.id || "");
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error al cargar inversionistas" });
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
    setNotice(null);
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
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo crear inversionista");
      }
      setNotice({ type: "success", message: `Inversionista creado: ${json.ownerId}` });
      if (res.ok) {
        (event.currentTarget as HTMLFormElement).reset();
        setNewCapitalInicial("0.00");
        await loadInvestors();
      }
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error al crear inversionista" });
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteInvestor(ownerId: string, nombre: string) {
    if (pendingAction) return;
    setNotice(null);
    const typed = window.prompt(
      `Vas a borrar completamente a ${nombre} (${ownerId}).\n` +
        "Esto elimina compras, lotes, ventas relacionadas, movimientos y utilidades.\n" +
        "Escribe BORRAR para confirmar:",
    );
    if (!typed) return;
    if (typed.trim().toUpperCase() !== "BORRAR") {
      setNotice({ type: "error", message: "Confirmación inválida. Debes escribir BORRAR." });
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
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo borrar inversionista");
      setNotice({ type: "success", message: `Inversionista eliminado: ${ownerId}` });
      await loadInvestors();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error al borrar inversionista" });
    } finally {
      setPendingAction(null);
    }
  }

  async function createInvestorUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setPendingAction("create-user");
    setNotice(null);
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
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo crear usuario de inversionista");
      setNotice({ type: "success", message: `Usuario creado: ${json.username}` });
      setNewInvestorUsername("");
      setNewInvestorPassword("");
      setNewInvestorUserName("");
      await loadInvestors();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error al crear usuario" });
    } finally {
      setPendingAction(null);
    }
  }

  async function createCapitalMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingAction) return;
    setPendingAction("capital-move");
    setNotice(null);
    try {
      const res = await fetch(`/api/investors/${encodeURIComponent(movementOwnerId)}/capital/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: movementType,
          amount: Number(movementAmount || 0),
          motivo: movementMotivo.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo registrar movimiento de capital");
      setNotice({
        type: "success",
        message: `${movementType === "APORTE_CAPITAL" ? "Aporte" : "Retiro"} registrado. Capital actual: $${formatMoney(
          Number(json.currentCapitalAfter ?? 0),
        )}`,
      });
      setMovementAmount("0.00");
      setMovementMotivo("");
      await loadInvestors();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Error registrando movimiento" });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section>
      {notice && (
        <div
          className="card"
          style={{
            background: notice.type === "success" ? "#ecfdf5" : "#fef2f2",
            borderColor: notice.type === "success" ? "#86efac" : "#fecaca",
            color: notice.type === "success" ? "#166534" : "#991b1b",
          }}
        >
          {notice.message}
        </div>
      )}

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
                <th>Acciones admin</th>
              </tr>
            </thead>
            <tbody>
              {investors.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.nombre}</td>
                  <td>{inv.tipo}</td>
                  <td>{inv.usuarioInversionista || <span style={{ color: "#64748b" }}>Sin usuario</span>}</td>
                  <td>${formatMoney(inv.capitalInicial)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
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

      <div className="card">
        <h2>Movimientos de capital externo</h2>
        <form onSubmit={createCapitalMovement}>
          <div className="grid">
            <label>
              Inversionista
              <select value={movementOwnerId} onChange={(e) => setMovementOwnerId(e.target.value)} required>
                {investors.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.nombre} ({inv.id})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo de movimiento
              <select value={movementType} onChange={(e) => setMovementType(e.target.value as "APORTE_CAPITAL" | "RETIRO_CAPITAL")}>
                <option value="APORTE_CAPITAL">Aporte de capital</option>
                <option value="RETIRO_CAPITAL">Retiro de capital</option>
              </select>
            </label>
            <label>
              Monto
              <MoneyInput value={movementAmount} onValueChange={setMovementAmount} required />
            </label>
            <label>
              Motivo (opcional)
              <input value={movementMotivo} onChange={(e) => setMovementMotivo(e.target.value)} />
            </label>
          </div>
          <LoadingButton
            type="submit"
            disabled={!!pendingAction || investors.length === 0}
            loading={pendingAction === "capital-move"}
            loadingText="Registrando..."
          >
            Registrar movimiento
          </LoadingButton>
        </form>
      </div>

    </section>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}
