"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LoadingButton } from "@/components/ui/loading-button";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  return (
    <LoadingButton
      type="button"
      variant="contrast"
      size="sm"
      loading={loading}
      loadingText="Cerrando..."
      onClick={async () => {
        if (loading) return;
        setLoading(true);
        await signOut({ callbackUrl: "/login" });
      }}
    >
      Cerrar sesión
    </LoadingButton>
  );
}
