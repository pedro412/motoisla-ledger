import { ButtonSpinner } from "@/components/ui/button-spinner";

export default function DashboardLoading() {
  return (
    <section className="space-y-4">
      <div className="card">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ButtonSpinner />
          Actualizando dashboard...
        </div>
      </div>
    </section>
  );
}
