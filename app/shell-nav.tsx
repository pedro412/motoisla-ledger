"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, ChartNoAxesCombined, HandCoins, PackagePlus, ReceiptText, ScrollText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: ChartNoAxesCombined },
  { href: "/investors", label: "Inversionistas", icon: Users },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/purchases/new", label: "Nueva compra", icon: PackagePlus },
  { href: "/sales/new", label: "Nueva venta", icon: HandCoins },
  { href: "/auditoria", label: "Auditoría", icon: ScrollText },
  { href: "/api/health/db", label: "Estado DB", icon: ReceiptText },
];

export function ShellNav() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
