import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    const role = String(token.role ?? "");
    const pathname = req.nextUrl.pathname;
    const blockedForInvestor =
      pathname.startsWith("/purchases") ||
      pathname.startsWith("/sales") ||
      pathname.startsWith("/investors") ||
      pathname.startsWith("/api/purchases") ||
      pathname.startsWith("/api/sales") ||
      pathname.startsWith("/api/investors") ||
      pathname.startsWith("/api/capital/reconcile");

    if (role === "INVERSIONISTA" && blockedForInvestor) {
      if (isApiPath(pathname)) {
        return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  }

  if (isApiPath(req.nextUrl.pathname)) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/auditoria/:path*",
    "/investors/:path*",
    "/inventario/:path*",
    "/purchases/:path*",
    "/sales/:path*",
    "/api/investors/:path*",
    "/api/lots/:path*",
    "/api/purchases/:path*",
    "/api/sales/:path*",
    "/api/capital/:path*",
  ],
};
