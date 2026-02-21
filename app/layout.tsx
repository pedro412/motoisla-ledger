import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotoIsla Ledger",
  description: "Ledger append-only con Google Sheets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="header">
          <nav>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/investors">Inversionistas</Link>
            <Link href="/inventario">Inventario</Link>
            <Link href="/purchases/new">Nueva compra</Link>
            <Link href="/sales/new">Nueva venta</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
