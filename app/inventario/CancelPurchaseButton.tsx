"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelPurchaseButton({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onCancel() {
    if (loading) return;
    const reason = window.prompt("Motivo de cancelación de la compra:");
    if (!reason || reason.trim().length < 3) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/purchases/${encodeURIComponent(purchaseId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo cancelar la compra");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Error al cancelar la compra");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="danger" size="sm" onClick={onCancel} disabled={loading}>
      {loading ? "Cancelando..." : "Cancelar compra"}
    </Button>
  );
}
