"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShellNav } from "@/app/shell-nav";
import { LogoutButton } from "@/app/logout-button";

type SessionLike = {
  user?: {
    name?: string | null;
    username?: string | null;
    role?: string | null;
  } | null;
} | null;

export function AppChrome({
  children,
  session,
}: {
  children: React.ReactNode;
  session: SessionLike;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="container">{children}</main>;
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-[1600px] md:grid-cols-[250px_1fr]">
      <aside className="border-r border-border/80 bg-white/70 p-4 backdrop-blur-md">
        <Link href="/dashboard" className="mb-5 inline-flex items-center gap-2 text-xl font-bold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            M
          </span>
          MotoIsla Ledger
        </Link>
        <ShellNav role={session?.user?.role ?? null} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-background/85 px-6 py-3 backdrop-blur">
          <p className="text-sm text-muted-foreground">Control financiero por inversionista</p>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <span className="rounded-md border border-border bg-card px-3 py-1 text-sm">
                  {session.user.name || session.user.username || "Usuario"} ({session.user.role || "OPERADOR"})
                </span>
                <LogoutButton />
              </>
            ) : (
              <Link href="/login" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                Iniciar sesión
              </Link>
            )}
          </div>
        </header>
        <main className="container">{children}</main>
      </div>
    </div>
  );
}
