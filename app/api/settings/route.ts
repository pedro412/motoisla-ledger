import { NextResponse } from "next/server";
import { AuditEntity } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { getSetting, setSetting } from "@/lib/settings";

const ALLOWED_KEYS = new Set(["opex_rate"]);

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const settings = await db.systemSetting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return NextResponse.json({ ok: true, settings: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });

    const body = await req.json();
    const { key, value } = body as { key: string; value: string };

    if (!key || !ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ ok: false, error: `Clave no permitida: ${key}` }, { status: 400 });
    }

    if (key === "opex_rate") {
      let numericValue = parseFloat(value);
      if (isNaN(numericValue)) {
        return NextResponse.json({ ok: false, error: "Valor inválido: debe ser un número" }, { status: 400 });
      }
      // Accept percentage (0-100) and convert to decimal (0-1)
      if (numericValue > 1) {
        numericValue = numericValue / 100;
      }
      if (numericValue < 0 || numericValue > 1) {
        return NextResponse.json({ ok: false, error: "Valor fuera de rango (0-100%)" }, { status: 400 });
      }
      const oldValue = await getSetting(key);
      const normalizedValue = String(numericValue);
      await setSetting(key, normalizedValue, user.id);
      await logAudit({
        actorUserId: user.id,
        action: "setting.updated",
        entity: AuditEntity.SETTING,
        entityId: key,
        payload: { key, oldValue, newValue: normalizedValue },
      });
      return NextResponse.json({ ok: true, key, value: normalizedValue });
    }

    return NextResponse.json({ ok: false, error: "Clave no implementada" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
