import { NextResponse } from "next/server";
import { getSessionUser, isAdmin } from "@/lib/authz";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
    if (!isAdmin(user)) return NextResponse.json({ ok: false, error: "Solo admin puede operar capital" }, { status: 403 });
    return NextResponse.json(
      {
        ok: false,
        error: "Capital inicial es inmutable; usa aporte/retiro de capital externo.",
      },
      { status: 410 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
