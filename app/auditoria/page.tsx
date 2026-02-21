import Link from "next/link";
import { AuditEntity, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isInvestor } from "@/lib/authz";

type AuditView = {
  id: string;
  date: string;
  actor: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  ownerRefs: string[];
  payloadSummary: string;
};

export default async function AuditoriaPage({ searchParams }: { searchParams?: { ownerId?: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section>
        <h1>Auditoría</h1>
        <div className="card">No autenticado.</div>
      </section>
    );
  }

  const owners = await db.owner.findMany({
    where: { type: "INVESTOR" },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const requestedOwnerId = searchParams?.ownerId;
  const effectiveOwnerId = isInvestor(user) ? user.ownerId ?? "" : requestedOwnerId ?? "";

  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actorIds = Array.from(new Set(rows.map((r) => r.actorUserId).filter(Boolean))) as string[];
  const actorUsers = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, username: true, name: true } })
    : [];
  const actorById = new Map(actorUsers.map((u) => [u.id, u.name || u.username]));

  const filteredRows = rows.filter((row) => {
    const ownerRefs = extractOwnerIds(row.payload);
    if (isInvestor(user)) {
      return ownerRefs.includes(effectiveOwnerId);
    }
    if (effectiveOwnerId) {
      return ownerRefs.includes(effectiveOwnerId);
    }
    return true;
  });

  const items: AuditView[] = filteredRows.map((row) => {
    const ownerRefs = extractOwnerIds(row.payload);
    return {
      id: row.id,
      date: row.createdAt.toISOString().slice(0, 19).replace("T", " "),
      actor: row.actorUserId ? actorById.get(row.actorUserId) ?? row.actorUserId : "sistema",
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      ownerRefs,
      payloadSummary: summarizePayload(row.payload),
    };
  });

  return (
    <section>
      <h1>Auditoría</h1>
      <div className="card">
        <div className="flex flex-wrap gap-2">
          {!isInvestor(user) && (
            <>
              <Link
                href="/auditoria"
                className={!effectiveOwnerId ? "move-badge move-badge-transfer" : "move-badge move-badge-other"}
              >
                Todos
              </Link>
              {owners.map((o) => (
                <Link
                  key={o.id}
                  href={`/auditoria?ownerId=${encodeURIComponent(o.id)}`}
                  className={effectiveOwnerId === o.id ? "move-badge move-badge-transfer" : "move-badge move-badge-other"}
                >
                  {o.name} ({o.id})
                </Link>
              ))}
            </>
          )}
          {isInvestor(user) && <span className="move-badge move-badge-transfer">Inversionista: {effectiveOwnerId}</span>}
        </div>
      </div>

      <div className="card">
        <h2>Eventos ({items.length})</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>ID</th>
                <th>Owner(s)</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{row.actor}</td>
                  <td>{row.action}</td>
                  <td>{row.entity}</td>
                  <td>{row.entityId}</td>
                  <td>{row.ownerRefs.join(", ") || "-"}</td>
                  <td>{row.payloadSummary}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={7}>Sin eventos para este filtro.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function extractOwnerIds(payload: Prisma.JsonValue | null): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const obj = payload as Record<string, unknown>;
  const out: string[] = [];
  if (typeof obj.ownerId === "string" && obj.ownerId) out.push(obj.ownerId);
  if (Array.isArray(obj.ownerIds)) {
    for (const value of obj.ownerIds) {
      if (typeof value === "string" && value) out.push(value);
    }
  }
  return Array.from(new Set(out));
}

function summarizePayload(payload: Prisma.JsonValue | null) {
  if (!payload) return "-";
  const raw = JSON.stringify(payload);
  if (raw.length <= 140) return raw;
  return `${raw.slice(0, 137)}...`;
}
