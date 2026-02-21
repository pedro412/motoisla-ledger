"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button type="button" variant="contrast" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
      Cerrar sesión
    </Button>
  );
}
