"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";

export function DeleteSaleButton({
  saleId,
  disabled,
  disabledReason,
}: {
  saleId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (loading || disabled) return;
    const typed = window.prompt(
      `Vas a borrar la venta ${saleId}.\n` +
        "Se restaurará stock/capital/utilidad de esta venta.\n" +
        "Escribe BORRAR para confirmar:",
    );
    if (!typed) return;
    if (typed.trim().toUpperCase() !== "BORRAR") {
      window.alert("Confirmación inválida. Debes escribir BORRAR.");
      return;
    }

    const reasonRaw = window.prompt("Motivo (opcional, recomendado para auditoría):");
    const reason = reasonRaw?.trim();

    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(saleId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmText: typed.trim(),
          reason: reason && reason.length >= 3 ? reason : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo borrar la venta");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Error al borrar la venta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoadingButton
      type="button"
      variant="danger"
      size="sm"
      onClick={onDelete}
      disabled={disabled}
      title={disabledReason}
      loading={loading}
      loadingText="Borrando..."
    >
      Borrar venta
    </LoadingButton>
  );
}
