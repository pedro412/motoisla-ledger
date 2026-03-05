"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChartNoAxesCombined, HandCoins, PackagePlus, ReceiptText, ScrollText, Settings2, ShoppingBag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items: { href: string; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/investors", label: "Inversionistas", icon: Users },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/purchases/new", label: "Nueva compra", icon: PackagePlus },
  { href: "/sales/new", label: "Nueva venta", icon: HandCoins },
  { href: "/sales", label: "Ventas", icon: ShoppingBag },
  { href: "/auditoria", label: "Auditoría", icon: ScrollText },
  { href: "/api/health/db", label: "Estado DB", icon: ReceiptText },
  { href: "/settings", label: "Configuración", icon: Settings2, adminOnly: true },
];

export function ShellNav({ role }: { role?: string | null }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items
        .filter((item) => {
          if (role === "INVERSIONISTA") {
            return item.href === "/dashboard" || item.href === "/inventario" || item.href === "/auditoria";
          }
          if (item.adminOnly && role !== "ADMIN") return false;
          return true;
        })
        .map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && item.href !== "/sales" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
