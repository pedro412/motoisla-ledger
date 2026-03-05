import { redirect } from "next/navigation";
import { getSessionUser, isAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) {
    redirect("/dashboard");
  }

  const setting = await db.systemSetting.findUnique({ where: { key: "opex_rate" } });
  const currentRate = setting ? parseFloat(setting.value) * 100 : 17.5;
  const updatedAt = setting?.updatedAt ?? null;

  return (
    <section className="space-y-4">
      <div className="card bg-gradient-to-r from-slate-700 to-slate-600 text-white">
        <h1 className="text-white">Configuración del sistema</h1>
        <p className="text-sm text-slate-200">Parámetros operativos aplicados a ventas nuevas.</p>
      </div>

      <div className="card space-y-4">
        <div>
          <h2>Tasa de gastos operativos (opex)</h2>
          <p className="text-sm text-muted-foreground">
            Porcentaje aplicado sobre las ventas brutas de cada línea para descontar gastos operativos antes del reparto
            50/50. Cada owner absorbe la mitad del total ({"{"}tasa × ventas brutas × 0.5{"}"}).
            Solo afecta ventas registradas a partir de ahora; los datos históricos conservan su valor original.
          </p>
        </div>
        <SettingsForm currentRate={currentRate} updatedAt={updatedAt?.toISOString() ?? null} />
      </div>
    </section>
  );
}
